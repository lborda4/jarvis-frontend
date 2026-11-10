import { expect, it } from 'vitest'
import { defaultConcepts } from './payrollDefaults'
import { payrollDeductionCategories, payrollDeductionCategory } from './payrollDeductionCategories'

it('separa salud, pensión y solidaridad sin perder las otras deducciones existentes', () => {
  for (const code of ['eps', 'pension', 'solidarity'])
    expect(payrollDeductionCategory(defaultConcepts.find(item => item.code === code))).toBe('Seguridad social')
  for (const code of ['subsistence', 'withholding', 'loan', 'other_deduction'])
    expect(payrollDeductionCategory(defaultConcepts.find(item => item.code === code))).toBe('Otras deducciones')
})

it('agrupa conceptos configurados de liquidación y licencia sin cambiar su naturaleza', () => {
  expect(payrollDeductionCategory({ code: 'internal_settlement', category: 'Liquidación', name: 'Descuento al retiro' })).toBe('Liquidación de contrato')
  expect(payrollDeductionCategory({ code: 'internal_leave', category: 'Licencias', name: 'Licencia no remunerada' })).toBe('Licencias no remuneradas')
  for (const concept of defaultConcepts.filter(item => item.kind === 'deduction'))
    expect(payrollDeductionCategories).toContain(payrollDeductionCategory(concept))
})
