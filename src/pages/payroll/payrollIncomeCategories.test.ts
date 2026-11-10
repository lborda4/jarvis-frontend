import { expect, it } from 'vitest'
import { defaultConcepts } from './payrollDefaults'
import { isPayrollSalaryAllowance, payrollIncomeCategories, payrollIncomeCategory } from './payrollIncomeCategories'

it('mantiene accesibles los conceptos existentes en las siete categorías', () => {
  const incomes = defaultConcepts.filter(item => item.kind === 'accrued')
  expect(new Set(incomes.map(payrollIncomeCategory)).size).toBe(7)
  for (const concept of incomes) expect(payrollIncomeCategories).toContain(payrollIncomeCategory(concept))
  expect(payrollIncomeCategory({ category: 'Comisiones especiales' })).toBe('Otros ingresos')
  expect(payrollIncomeCategory({ category: 'Liquidación' })).toBe('Liquidación de contrato')
})

it('separa el auxilio del salario sin inventar nuevos códigos de concepto', () => {
  expect(isPayrollSalaryAllowance(defaultConcepts.find(item => item.code === 'transportation_allowance')!)).toBe(true)
  expect(isPayrollSalaryAllowance(defaultConcepts.find(item => item.code === 'salary')!)).toBe(false)
})
