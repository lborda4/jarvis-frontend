import { describe, expect, it } from 'vitest'
import { payrollFixedLawDeductionId, payrollRequiredDeductionErrors } from './payrollRequiredDeductions'
import type { PayrollLine } from './payrollDomain'

const lines: PayrollLine[] = [
  { id: 'eps', concept: 'eps', kind: 'deduction', quantity: '1', amount: '0', typeLawDeductionsId: 31 },
  { id: 'pension', concept: 'pension', kind: 'deduction', quantity: '1', amount: '100', typeLawDeductionsId: 51 },
]
describe('EPS y pensión obligatorias para el envío', () => {
  it('asigna los códigos fijos a las cuatro deducciones', () => {
    expect(['eps', 'pension', 'solidarity', 'subsistence'].map(payrollFixedLawDeductionId)).toEqual([4, 6, 9, 9])
    expect(payrollFixedLawDeductionId('other_deduction')).toBeUndefined()
  })
  it('exige ambos conceptos sin inventar deducciones', () => {
    const state = { lines: [] }
    expect(payrollRequiredDeductionErrors(state)).toHaveLength(2)
    expect(state.lines).toEqual([])
  })
  it('acepta un valor cero explícito con un código seleccionado', () => {
    expect(payrollRequiredDeductionErrors({ lines })).toEqual([])
  })
  it('exige el valor y permite omitir los códigos automáticos', () => {
    const errors = payrollRequiredDeductionErrors({ lines: lines.map(line => ({ ...line, amount: '', typeLawDeductionsId: undefined })) })
    expect(errors).toHaveLength(2)
    expect(payrollRequiredDeductionErrors({ lines: lines.map(line => ({ ...line, typeLawDeductionsId: undefined })) })).toEqual([])
  })
  it('admite los códigos históricos explícitos y conceptos con homologación', () => {
    expect(payrollRequiredDeductionErrors({ lines: lines.map(line => ({ ...line, concept: `internal_${line.concept}`, mapping: line.concept, typeLawDeductionsId: undefined })), epsTypeLawDeductionsId: 31, pensionTypeLawDeductionsId: 51 })).toEqual([])
  })
})
