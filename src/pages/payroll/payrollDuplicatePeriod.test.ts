import { expect, it } from 'vitest'
import { payrollDuplicatePeriod } from './payrollDuplicatePeriod'
import { blankEmployee, blankPayroll } from './payrollDefaults'
import type { PayrollDocument } from '../../services/payrollService'

function source(id: string, group = 'first') {
  return { id, employeeId: id, originalId: null, employee: blankEmployee(), status: 'ACCEPTED',
    state: { ...blankPayroll('2026-01'), startDate: '2026-01-01', endDate: '2026-01-15', payrollGroupId: group,
      lines: [{ id: `salary-${id}`, concept: 'salary', kind: 'accrued', quantity: '13', amount: '1000' }] },
  } as PayrollDocument
}
it('selecciona todos los empleados del período exacto y conserva sus novedades', () => {
  const first = source('ana'), second = source('luis')
  const anotherGroup = source('other', 'different')
  const adjustment = { ...source('note'), originalId: 'ana' }
  const otherHalf = { ...source('second-half'), state: { ...first.state, startDate: '2026-01-16', endDate: '2026-01-31' } }
  expect(payrollDuplicatePeriod([first, anotherGroup, adjustment, otherHalf, second], 'ana')).toEqual([first, second])
  expect(first.state.lines[0].amount).toBe('1000')
})
it('no permite usar una nota ni una nómina inexistente como origen', () => {
  expect(payrollDuplicatePeriod([source('ana')], 'foreign')).toEqual([])
  expect(payrollDuplicatePeriod([{ ...source('note'), originalId: 'ana' }], 'note')).toEqual([])
})
