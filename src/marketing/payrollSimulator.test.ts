import { describe, expect, it } from 'vitest'
import { COMPLIANCE_COMBOS, PAYROLL_PLAN, PAYROLL_TOP_UPS } from './catalog'
import { buildManualPayrollPlan, estimatePayrollPlan, payrollEstimateMessage } from './payrollSimulator'

describe('simulador de nómina', () => {
  it('usa cupos de empleados durante el año sin multiplicarlos por doce', () => {
    expect(estimatePayrollPlan(2)).toMatchObject({ employees: 2, capacity: 2, totalAmount: 129900, packs: [] })
    expect(estimatePayrollPlan(5)).toMatchObject({ capacity: 5, totalAmount: 184900, packs: [{ employees: 3, quantity: 1, amount: 55000 }] })
  })
  it('suma y repite las recargas manuales sin cambiar el plan elegido', () => {
    expect(buildManualPayrollPlan('basic', { 5: 1, 10: 1 })).toMatchObject({ capacity: 17, totalAmount: 379900 })
    expect(buildManualPayrollPlan('basic', { 20: 3 })).toMatchObject({ capacity: 62, totalAmount: 999900, unlimited: false })
    expect(buildManualPayrollPlan('basic', {})).toMatchObject({ capacity: 2, totalAmount: 129900 })
  })
  it('permite el combo ilimitado manual sin sumar recargas ocultas', () => {
    expect(buildManualPayrollPlan('unlimited', { 20: 3 })).toMatchObject({ capacity: null, totalAmount: 720000, packs: [], unlimited: true })
  })
  it('recomienda el combo ilimitado para grandes volúmenes', () => {
    expect(estimatePayrollPlan(1_000_000_000)).toMatchObject({ employees: 1_000_000_000, unlimited: true, totalAmount: 720000 })
  })
  it('compara el cálculo automático con todas las combinaciones dentro del presupuesto', () => {
    const visited = new Map<string, number>()
    const choices: { employees: number; amount: number }[] = []
    const budget = COMPLIANCE_COMBOS[1].amount
    const visit = (index: number, employees: number, amount: number) => {
      const key = index + ':' + employees
      if ((visited.get(key) ?? Infinity) <= amount) return
      visited.set(key, amount)
      if (index === PAYROLL_TOP_UPS.length) { choices.push({ employees, amount }); return }
      const pack = PAYROLL_TOP_UPS[index]
      for (let quantity = 0; amount + quantity * pack.amount <= budget; quantity++) visit(index + 1, employees + quantity * pack.employees, amount + quantity * pack.amount)
    }
    visit(0, PAYROLL_PLAN.employees, PAYROLL_PLAN.amount)
    for (const employees of [1, 2, 3, 4, 5, 6, 8, 12, 17, 22, 25, 32, 35, 40, 100]) {
      const result = estimatePayrollPlan(employees)!
      const cheapest = Math.min(COMPLIANCE_COMBOS[1].amount, ...choices.filter(choice => choice.employees >= employees).map(choice => choice.amount))
      expect(result.totalAmount).toBe(cheapest)
      if (result.capacity !== null) expect(result.capacity).toBeGreaterThanOrEqual(employees)
    }
  })
  it.each([0, -1, 1.5, NaN, Infinity, 1_000_000_001])('rechaza empleados inválidos: %s', value => {
    expect(estimatePayrollPlan(value)).toBeNull()
  })
  it.each([-1, 1.5, NaN, Infinity, 10001])('rechaza cantidades de recargas inválidas: %s', value => {
    expect(buildManualPayrollPlan('basic', { 1: value })).toBeNull()
  })
  it('prepara la cotización de nómina con empleados y precios', () => {
    const automatic = payrollEstimateMessage(estimatePayrollPlan(5)!, false)
    expect(automatic).toContain('Tengo 5 empleados')
    expect(automatic).toContain('$184.900 COP')
    expect(automatic).not.toContain('facturas al año')
    const manual = payrollEstimateMessage(buildManualPayrollPlan('basic', { 5: 1 })!, true)
    expect(manual).toContain('manualmente')
    expect(manual).toContain('1 × 5 empleados')
    expect(manual).toContain('Cupo: 7 empleados')
  })
})
