import { expect, it } from 'vitest'
import { buildPayrollValueDeductions, payrollValueDeductionErrors, totals, type PayrollLine } from './payrollDomain'

const keys = ['third_party_payment_deduction', 'advance', 'other_deduction', 'voluntary', 'withholding', 'afc', 'cooperative', 'garnishment', 'supplementary_plan', 'education', 'refund_deduction', 'debt']
const lines: PayrollLine[] = keys.map(concept => ({ id: concept, concept, kind: 'deduction', amount: '10.25', quantity: '1', ...(concept === 'other_deduction' ? { description: '  Cuota especial  ' } : {}) }))

it('homologa los tres arreglos y los nueve campos numéricos sin enviar datos internos', () => {
  expect(buildPayrollValueDeductions(lines)).toEqual({
    third_party_payments: [{ third_party_payment: 10.25 }], advances: [{ advance: 10.25 }], other_deductions: [{ other_deduction: 10.25, description_deduction: 'Cuota especial' }],
    voluntary_pension: 10.25, withholding_at_source: 10.25, afc: 10.25, cooperative: 10.25, tax_liens: 10.25, supplementary_plan: 10.25, education: 10.25, refund: 10.25, debt: 10.25,
  })
  expect(totals(lines).deductions).toBe('123.00')
})

it('conserva filas independientes y omite descripciones vacías y conceptos no elegidos', () => {
  expect(buildPayrollValueDeductions([{ ...lines[2], description: '' }, { ...lines[2], id: 'other2', description: 'Otra cuota' }])).toEqual({ other_deductions: [{ other_deduction: 10.25 }, { other_deduction: 10.25, description_deduction: 'Otra cuota' }] })
  expect(buildPayrollValueDeductions([])).toEqual({})
})

it('suma conceptos y alias escalares con precisión de centavos', () => {
  expect(buildPayrollValueDeductions([{ ...lines[3], amount: '0.10' }, { ...lines[3], concept: 'voluntary_pension', id: 'another', amount: '0.20' }])).toEqual({ voluntary_pension: 0.3 })
})

it('acepta importes en cero si la deducción fue registrada explícitamente', () => {
  expect(buildPayrollValueDeductions([{ ...lines[0], amount: '0' }, { ...lines[3], amount: '0' }])).toEqual({ third_party_payments: [{ third_party_payment: 0 }], voluntary_pension: 0 })
})

it('excluye devengados homónimos y respeta los mapeos internos de deducciones', () => {
  const chosen: PayrollLine[] = [
    { ...lines[0], concept: 'third_party_payments', kind: 'accrued', amount: '100' },
    { ...lines[0], concept: 'advances', kind: 'accrued', amount: '100' },
    { ...lines[0], concept: 'refund', kind: 'accrued', amount: '100' },
    { ...lines[0], concept: 'internal_third', mapping: 'third_party_payments' },
    { ...lines[1], concept: 'internal_advance', mapping: 'advances' },
    { ...lines[10], concept: 'internal_refund', mapping: 'refund' },
  ]
  expect(buildPayrollValueDeductions(chosen)).toEqual({ third_party_payments: [{ third_party_payment: 10.25 }], advances: [{ advance: 10.25 }], refund: 10.25 })
  expect(totals(chosen)).toEqual({ accrued: '300.00', deductions: '30.75', net: '269.25' })
})

it.each(['-1', '1.234', 'abc', ''])('rechaza importes inválidos: %s', amount => {
  const line = { ...lines[0], amount }
  expect(payrollValueDeductionErrors(line).length).toBeGreaterThan(0)
  expect(() => buildPayrollValueDeductions([line])).toThrow()
})
