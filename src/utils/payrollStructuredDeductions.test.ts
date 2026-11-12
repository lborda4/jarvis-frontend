import { expect, it } from 'vitest'
import { buildPayrollStructuredDeductions, payrollStructuredDeductionErrors, totals, type PayrollLine } from './payrollDomain'

const union: PayrollLine = { id: 'union', concept: 'labor_union', kind: 'deduction', quantity: '1', amount: '10.25', percentage: '2.5' }
const sanction: PayrollLine = { id: 'sanction', concept: 'sanctions', kind: 'deduction', quantity: '1', amount: '30.30', publicSanction: '10.10', privateSanction: '20.20' }
const order: PayrollLine = { id: 'order', concept: 'loan', kind: 'deduction', quantity: '1', amount: '50.25', description: '  Crédito de vivienda  ' }

it('serializa los tres arreglos con sus campos exactos y conserva las filas', () => {
  const lines = [union, sanction, order, { ...order, id: 'another', description: 'Otro crédito' }]
  expect(buildPayrollStructuredDeductions(lines)).toEqual({
    labor_union: [{ percentage: 2.5, deduction: 10.25 }],
    sanctions: [{ public_sanction: 10.1, private_sanction: 20.2 }],
    orders: [{ description: 'Crédito de vivienda', deduction: 50.25 }, { description: 'Otro crédito', deduction: 50.25 }],
  })
  expect(totals(lines).deductions).toBe('141.05')
})

it.each(['publicSanction', 'privateSanction'] as const)('admite solamente %s y omite los otros arreglos', field => {
  const line = { ...sanction, amount: '10', publicSanction: '', privateSanction: '', [field]: '10' }
  expect(buildPayrollStructuredDeductions([line])).toEqual({ sanctions: [field === 'publicSanction' ? { public_sanction: 10 } : { private_sanction: 10 }] })
  expect(buildPayrollStructuredDeductions([])).toEqual({})
})

it.each([
  { ...union, percentage: '' }, { ...union, percentage: '-1' }, { ...union, percentage: '101' },
  { ...union, percentage: '1.234' }, { ...order, description: '' }, { ...order, description: '  ' },
  { ...sanction, amount: '10' }, { ...sanction, publicSanction: '-10' },
  { ...sanction, amount: '0', publicSanction: '', privateSanction: '' }, { ...union, kind: 'accrued' as const },
])('rechaza los datos incompletos o inconsistentes: %j', line => {
  expect(payrollStructuredDeductionErrors(line).length).toBeGreaterThan(0)
  expect(() => buildPayrollStructuredDeductions([line])).toThrow()
})

it('respeta el mapeo de un concepto interno de libranza', () => {
  expect(buildPayrollStructuredDeductions([{ ...order, concept: 'internal_credit', mapping: 'loan' }])).toEqual({ orders: [{ description: 'Crédito de vivienda', deduction: 50.25 }] })
})
