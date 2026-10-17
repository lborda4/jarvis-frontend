import { describe, expect, it } from 'vitest'
import {
  buildPayrollPayload,
  cents,
  money,
  prorate,
  totals,
  validatePayroll,
  validDate,
} from './payrollDomain'
const worker = {
  firstName: 'Ana',
  surname: 'Pérez',
  salary: '2000000',
  identification: '12345678',
  typeWorkerId: 1,
  subTypeWorkerId: 1,
  documentTypeId: 3,
  paymentMethodId: 1,
  admittanceDate: '2026-01-01',
  active: true,
}
const state = {
  employeeId: 'employee',
  period: '2026-10',
  startDate: '2026-10-01',
  endDate: '2026-10-31',
  issueDate: '2026-11-01',
  workedDays: '30',
  lines: [
    {
      id: 'salary',
      concept: 'salary',
      kind: 'accrued' as const,
      amount: '2000000.10',
      quantity: '30',
    },
    {
      id: 'eps',
      concept: 'eps',
      kind: 'deduction' as const,
      amount: '80000.01',
      quantity: '1',
      percentage: '4',
    },
  ],
}
describe('nómina: precisión y validación', () => {
  it('bloquea un campo de trabajador cuyo mapeo no está verificado', () =>
    expect(
      validatePayroll(state, { ...worker, secondSurname: 'López' }, true).join(
        ' ',
      ),
    ).toContain('pendiente de verificar'))
  it('permite conceptos internos con un mapeo verificado', () => {
    const input = {
      ...state,
      lines: [
        { ...state.lines[0], concept: 'internal_bonus', mapping: 'salary' },
      ],
    }
    expect(validatePayroll(input, worker, true)).toEqual([])
    expect(
      buildPayrollPayload(input, worker, 1, 'NE').accrued.salary,
    ).toHaveLength(1)
  })
  it('suma centavos sin error binario', () =>
    expect(
      totals([
        { ...state.lines[0], amount: '0.10' },
        { ...state.lines[0], amount: '0.20' },
      ]).net,
    ).toBe('0.30'))
  it('descuenta deducciones del neto', () =>
    expect(totals(state.lines)).toEqual({
      accrued: '2000000.10',
      deductions: '80000.01',
      net: '1920000.09',
    }))
  it('redondea prorrateos al centavo', () =>
    expect(prorate('100', '1', '3')).toBe('33.33'))
  it('rechaza bases cero', () =>
    expect(() => prorate('100', '1', '0')).toThrow())
  it.each(['-1', 'NaN', '1,23', '0.001', 'Infinity', '1e3'])(
    'rechaza importe %s',
    (value) => expect(() => cents(value)).toThrow(),
  )
  it('conserva signos en totales', () => expect(money(-101n)).toBe('-1.01'))
  it.each(['2026-02-30', '2026-13-01', 'invalid', ''])(
    'rechaza fecha %s sin lanzar',
    (value) => expect(validDate(value)).toBe(false),
  )
  it('permite guardar conceptos sin mapeo pero bloquea transmisión', () => {
    const input = {
      ...state,
      lines: [...state.lines, { ...state.lines[0], concept: 'disability' }],
    }
    expect(validatePayroll(input, worker)).toEqual([])
    expect(validatePayroll(input, worker, true).join(' ')).toContain(
      'pendientes de integración',
    )
  })
  it('bloquea neto negativo', () =>
    expect(
      validatePayroll({ ...state, lines: [state.lines[1]] }, worker).join(' '),
    ).toContain('superan'))
  it('bloquea períodos ajenos al mes seleccionado', () =>
    expect(
      validatePayroll({ ...state, period: '2026-09' }, worker).join(' '),
    ).toContain('coincidir'))
  it('bloquea empleado inactivo al transmitir', () =>
    expect(
      validatePayroll(state, { ...worker, active: false }, true),
    ).toContain('El empleado está inactivo.'))
  it('bloquea períodos anteriores al ingreso', () =>
    expect(
      validatePayroll(state, { ...worker, admittanceDate: '2026-10-05' })
        .length,
    ).toBeGreaterThan(0))
  it('construye estructura verificada sin datos internos', () => {
    const payload = buildPayrollPayload(state, worker, 1, 'NE')
    expect(payload.type_document_id).toBe(9)
    expect(payload.predecessor).toEqual({})
    expect(payload.accrued.salary[0]).toEqual({
      payment: '2000000.10',
      worked_days: '30.00',
    })
    expect(payload.deductions.eps).toEqual({
      payment: '80000.01',
      percentage: '4.00',
    })
    expect(payload).not.toHaveProperty('employeeId')
  })
  it('mantiene referencia del original en notas', () => {
    const predecessor = {
      predecessor_number: 'NE1',
      predecessor_cune: 'abc',
      predecessor_issue_date: '2026-10-01',
    }
    const payload = buildPayrollPayload(
      { ...state, noteType: 2 },
      worker,
      2,
      'NE',
      predecessor,
    )
    expect(payload.type_document_id).toBe(10)
    expect(payload).toMatchObject({ type_note: 2 })
    expect(payload.predecessor).toEqual(predecessor)
  })
})
