import { expect, it } from 'vitest'
import { buildManualComboPlan, comboEstimateMessage, estimateComboPlan } from './comboSimulator'

it('cobra una sola vez el combo inicial, con ambos cupos incluidos', () => {
  expect(estimateComboPlan(50, 'year', 2)).toMatchObject({ documents: 50, employees: 2, totalAmount: 220000, billingPacks: [], payrollPacks: [] })
})
it('combina las recomendaciones de documentos y empleados al precio del combo', () => {
  const result = estimateComboPlan(200, 'year', 5)!
  expect(result).toMatchObject({ documents: 200, employees: 5, totalAmount: 504900, unlimited: false })
  expect(result.billingPacks).toHaveLength(2)
  expect(result.payrollPacks).toEqual([{ employees: 3, quantity: 1, amount: 55000 }])
  expect(estimateComboPlan(20, 'month', 5)).toMatchObject({ documents: 250, employees: 5, totalAmount: 574800 })
})
it('compara el costo conjunto con el ilimitado aunque ambos productos por separado sean limitados', () => {
  expect(estimateComboPlan(400, 'year', 15)).toMatchObject({ unlimited: true, totalAmount: 720000, documents: null, employees: null })
  expect(estimateComboPlan(1_000_000_000, 'month', 2)).toMatchObject({ unlimited: true, totalAmount: 720000 })
})
it('permite recargas manuales de ambos tipos y respeta su selección', () => {
  expect(buildManualComboPlan('basic', { 100: 1, 50: 1 }, { 5: 1 })).toMatchObject({ documents: 200, employees: 7, totalAmount: 539900 })
  expect(buildManualComboPlan('basic', { 500: 2 }, { 20: 2 })).toMatchObject({ unlimited: false, totalAmount: 1820000 })
  expect(buildManualComboPlan('unlimited', { 500: 2 }, { 20: 2 })).toMatchObject({ unlimited: true, totalAmount: 720000, billingPacks: [], payrollPacks: [] })
})
it('requiere cantidades válidas para ambos productos', () => {
  expect(estimateComboPlan(50, 'year', 0)).toBeNull()
  expect(estimateComboPlan(0, 'year', 2)).toBeNull()
  expect(buildManualComboPlan('basic', { 10: -1 }, {})).toBeNull()
  expect(buildManualComboPlan('basic', {}, { 5: 0.5 })).toBeNull()
})
it('incluye ambos tipos de recargas en la cotización', () => {
  const message = comboEstimateMessage(buildManualComboPlan('basic', { 100: 1 }, { 5: 1 })!)
  expect(message).toContain('1 × 100 documentos, 1 × 5 empleados')
  expect(message).toContain('150 documentos y 7 empleados')
  expect(message).toContain('$459.900 COP')
})
