import { expect, it } from 'vitest'
import type { PayrollLine } from '../../utils/payrollDomain'
import { payrollNoveltyKey, replacePayrollNoveltyLine } from './payrollNoveltyEntries'

it.each(['salary', 'transportation_allowance', 'vacation', 'disability', 'overtime_day', 'service_bonus', 'severance', 'loan', 'sanctions', 'other_deduction', 'voluntary'])('actualiza %s con todos sus datos sin crear otra fila', concept => {
  const original: PayrollLine = { id: 'saved', concept, kind: 'accrued', quantity: '15', amount: '100' }
  const changed = { ...original, quantity: '10', amount: '200', percentage: '3', description: 'Cambio', startDate: '2026-11-01', endDate: '2026-11-10', type: 2 }
  const result = replacePayrollNoveltyLine([original], changed)
  expect(result).toEqual([changed])
  expect(replacePayrollNoveltyLine(result, changed)).toEqual([changed])
  expect(original.amount).toBe('100')
})

it('elimina duplicados del mismo concepto sin modificar otros conceptos ni otra clase de movimiento', () => {
  const old: PayrollLine = { id: 'old', concept: 'salary', kind: 'accrued', amount: '100', quantity: '15' }
  const other = { ...old, id: 'other', concept: 'transportation_allowance' }
  const deduction = { ...old, id: 'deduction', kind: 'deduction' as const }
  const latest = { ...old, id: 'latest', amount: '200' }
  expect(replacePayrollNoveltyLine([old, other, latest, deduction], { ...latest, amount: '300' }))
    .toEqual([{ ...latest, amount: '300' }, other, deduction])
})

it('distingue los conceptos personalizados aunque tengan la misma homologación', () => {
  expect(payrollNoveltyKey({ concept: 'internal_one', mapping: 'commissions', kind: 'accrued' }))
    .not.toBe(payrollNoveltyKey({ concept: 'internal_two', mapping: 'commissions', kind: 'accrued' }))
})
