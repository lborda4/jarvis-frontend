import { expect, it } from 'vitest'
import { buildPayrollLawDeductions, type PayrollLine } from './payrollDomain'

const line = (concept: string, id?: number, amount = '10.25'): PayrollLine => ({ id: concept, concept, kind: 'deduction', quantity: '1', amount, typeLawDeductionsId: id })

it('homologa los cuatro conceptos a los campos exactos de NextPyme', () => {
  expect(buildPayrollLawDeductions([line('eps', 31), line('pension', 51), line('solidarity', 91), line('subsistence', 92)])).toEqual({
    eps_type_law_deductions_id: 31, eps_deduction: 10.25,
    pension_type_law_deductions_id: 51, pension_deduction: 10.25,
    fondossp_type_law_deductions_id: 91, fondosp_deduction_SP: 10.25,
    fondossp_sub_type_law_deductions_id: 92, fondosp_deduction_sub: 10.25,
  })
})

it('omite conceptos no seleccionados y admite importes cero con tipo seleccionado', () => {
  expect(buildPayrollLawDeductions([line('eps', 31, '0'), line('pension', 51, '0')])).toEqual({
    eps_type_law_deductions_id: 31, eps_deduction: 0, pension_type_law_deductions_id: 51, pension_deduction: 0,
  })
  expect(buildPayrollLawDeductions([])).toEqual({})
})

it('suma valores del mismo tipo con precisión de centavos', () => {
  expect(buildPayrollLawDeductions([line('solidarity', 91, '0.10'), line('solidarity', 91, '0.20')]).fondosp_deduction_SP).toBe(0.3)
})

it.each([undefined, 0, -1, 1.5, NaN])('rechaza IDs ausentes o inválidos: %s', id => {
  expect(() => buildPayrollLawDeductions([line('solidarity', id)])).toThrow('tipo de deducción')
})

it('rechaza mezclar dos tipos legales para un concepto', () => {
  expect(() => buildPayrollLawDeductions([line('eps', 31), line('eps', 32)])).toThrow('mezcles')
})

it('conserva IDs históricos y permite sustituirlos con una selección explícita', () => {
  expect(buildPayrollLawDeductions([line('eps')], { epsTypeLawDeductionsId: 3 }).eps_type_law_deductions_id).toBe(3)
  expect(buildPayrollLawDeductions([line('eps', 31)], { epsTypeLawDeductionsId: 3 }).eps_type_law_deductions_id).toBe(31)
})
