import { describe, expect, it } from 'vitest'
import { BILLING_PLANS, BILLING_TOP_UPS, COMPLIANCE_COMBOS } from './catalog'
import { billingEstimateMessage, buildManualBillingPlan, estimateBillingPlan } from './billingSimulator'

describe('simulador de facturación', () => {
  it('suma las recargas elegidas manualmente al cupo del plan', () => {
    expect(buildManualBillingPlan('initial', { 100: 1, 50: 1 })).toMatchObject({ capacity: 200, totalAmount: 369800, unlimited: false })
    expect(buildManualBillingPlan('regular', { 100: 2 })).toMatchObject({ capacity: 225, totalAmount: 439700 })
    expect(buildManualBillingPlan('initial', {})).toMatchObject({ capacity: 50, totalAmount: 139900, packs: [] })
  })
  it('respeta la selección manual aunque el ilimitado sea más económico', () => {
    expect(buildManualBillingPlan('initial', { 500: 2 })).toMatchObject({ capacity: 1050, totalAmount: 1099900, unlimited: false })
  })
  it.each([-1, 0.5, NaN, Infinity, 10001])('rechaza cantidades manuales inválidas: %s', quantity => {
    expect(buildManualBillingPlan('initial', { 100: quantity })).toBeNull()
  })
  it('el mensaje manual conserva la selección sin inventar un volumen de facturas', () => {
    const message = billingEstimateMessage(buildManualBillingPlan('initial', { 100: 1, 50: 1 })!, NaN, 'month', true)
    expect(message).toContain('Elegí las recargas manualmente')
    expect(message).toContain('1 × 50 documentos, 1 × 100 documentos')
    expect(message).toContain('$369.800 COP')
    expect(message).not.toContain('Emito')
    expect(message).not.toContain('NaN')
  })
  it('convierte el volumen mensual a anual y respeta el cupo de cada inscripción', () => {
    expect(estimateBillingPlan(4, 'month', 'initial')).toMatchObject({ annualDocuments: 48, capacity: 50, totalAmount: 139900, packs: [] })
    expect(estimateBillingPlan(25, 'year', 'regular')).toMatchObject({ capacity: 25, packs: [] })
    expect(estimateBillingPlan(50, 'year', 'regular')).toMatchObject({ capacity: 50, totalAmount: 184900, packs: [{ documents: 25, quantity: 1 }] })
  })
  it('combina paquetes y permite repetirlos sin quedarse corto ni duplicar el valor del plan', () => {
    const combined = estimateBillingPlan(200, 'year', 'initial')!
    expect(combined.packs).toEqual([{ documents: 100, quantity: 1, amount: 149900 }, { documents: 50, quantity: 1, amount: 80000 }])
    expect(combined.totalAmount).toBe(369800)
    expect(estimateBillingPlan(250, 'year', 'initial')!.packs).toEqual([{ documents: 100, quantity: 2, amount: 149900 }])
    const repeated = estimateBillingPlan(70, 'year', 'initial')!
    expect(repeated.packs).toEqual([{ documents: 25, quantity: 1, amount: 45000 }])
    // A 25 pack is cheaper than two 10 packs, even with five spare documents.
    expect(repeated.capacity).toBe(75)
  })
  it('recomienda el ilimitado cuando supera al plan con recargas y calcula volúmenes grandes sin recorrerlos', () => {
    expect(estimateBillingPlan(50, 'month', 'initial')).toMatchObject({ unlimited: false, totalAmount: 699900, capacity: 600 })
    expect(estimateBillingPlan(50, 'month', 'regular')).toMatchObject({ unlimited: true, totalAmount: 720000, capacity: null })
    expect(estimateBillingPlan(1_000_000_000, 'month', 'initial')).toMatchObject({ annualDocuments: 12_000_000_000, unlimited: true })
  })
  it.each([0, -1, 0.5, NaN, Infinity, 1_000_000_001])('rechaza una cantidad inválida: %s', quantity => {
    expect(estimateBillingPlan(quantity, 'year', 'initial')).toBeNull()
  })
  it('coincide con una búsqueda exhaustiva de combinaciones para ambos cupos', () => {
    for (const [registration, base] of [['initial', BILLING_PLANS[0]], ['regular', BILLING_PLANS[1]]] as const) {
      const budget = COMPLIANCE_COMBOS[1].amount - base.amount
      const possibilities: { documents: number; amount: number }[] = []
      const visit = (index: number, documents: number, amount: number) => {
        if (index === BILLING_TOP_UPS.length) { possibilities.push({ documents, amount }); return }
        const pack = BILLING_TOP_UPS[index]
        for (let count = 0; amount + count * pack.amount <= budget; count++) visit(index + 1, documents + count * pack.documents, amount + count * pack.amount)
      }
      visit(0, 0, 0)
      for (const annual of [1, 25, 26, 50, 51, 61, 70, 76, 100, 125, 151, 175, 200, 275, 325, 500, 575, 600, 601, 625, 650, 700]) {
        const result = estimateBillingPlan(annual, 'year', registration)!
        const cheapest = Math.min(COMPLIANCE_COMBOS[1].amount, ...possibilities.filter(item => item.documents + base.documents >= annual).map(item => item.amount + base.amount))
        expect(result.totalAmount).toBe(cheapest)
        if (result.capacity !== null) expect(result.capacity).toBeGreaterThanOrEqual(annual)
      }
    }
  })
  it('prepara el mensaje de asesoría con cantidades y total anual', () => {
    const result = estimateBillingPlan(200, 'year', 'initial')!
    const message = billingEstimateMessage(result, 200, 'year')
    expect(message).toContain('1 × 100 documentos, 1 × 50 documentos')
    expect(message).toContain('$369.800 COP')
    expect(message).toContain('200 facturas al año')
  })
})
