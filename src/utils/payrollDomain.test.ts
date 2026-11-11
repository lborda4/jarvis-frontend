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
  it('permite guardar un borrador vacío sin permitir enviarlo', () => {
    const empty = { ...state, lines: [] }
    expect(validatePayroll(empty, worker)).toEqual([])
    expect(validatePayroll(empty, worker, true)).toContain('Agrega al menos un devengado.')
  })
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
      lines: [...state.lines, { ...state.lines[0], concept: 'custom_benefit' }],
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
      validatePayroll(state, { ...worker, admittanceDate: '2026-11-01' })
        .length,
    ).toBeGreaterThan(0))
  it('permite ingreso y retiro durante el período liquidado', () => {
    expect(validatePayroll({ ...state, workedDays: '11' }, { ...worker, admittanceDate: '2026-10-10', retirementDate: '2026-10-20' })).toEqual([])
  })
  it('construye estructura verificada sin datos internos', () => {
    const payload = buildPayrollPayload(state, worker, 1, 'NE')
    expect(payload.type_document_id).toBe(9)
    expect(payload.period).toEqual({
      admision_date: '2026-01-01',
      settlement_start_date: '2026-10-01',
      settlement_end_date: '2026-10-31',
      worked_time: 300,
      issue_date: '2026-11-01',
    })
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
  it('serializa el bloque de deducciones sociales del proveedor', () => {
    const payload = buildPayrollPayload({
      ...state,
      lines: [
        { ...state.lines[0], amount: '1500000', quantity: '30' },
        {
          id: 'eps',
          concept: 'eps',
          kind: 'deduction' as const,
          amount: '60000',
          quantity: '1',
          percentage: '4',
          mapping: 'eps',
        },
        {
          id: 'pension',
          concept: 'pension',
          kind: 'deduction' as const,
          amount: '60000',
          quantity: '1',
          percentage: '4',
          mapping: 'pension',
        },
      ],
    }, worker, 1, 'SETP')

    expect(payload.deductions.eps).toEqual({ payment: '60000.00', percentage: '4.00' })
    expect(payload.deductions.pension).toEqual({ payment: '60000.00', percentage: '4.00' })
    expect(payload.deductions.eps_type_law_deductions_id).toBe(1)
    expect(payload.deductions.eps_deduction).toBe(60000)
    expect(payload.deductions.pension_type_law_deductions_id).toBe(2)
    expect(payload.deductions.pension_deduction).toBe(60000)
    expect(payload.deductions.deductions_total).toBe(120000)
  })
  it('serializa vacaciones compensadas como paid_vacation', () => {
    const payload = buildPayrollPayload({
      ...state,
      lines: [
        { ...state.lines[0], amount: '1500000', quantity: '30' },
        {
          id: 'vacation-paid',
          concept: 'vacation_paid',
          kind: 'accrued' as const,
          amount: '250000',
          quantity: '5',
          mapping: 'vacation_paid',
        },
      ],
    }, worker, 1, 'SETP')

    expect(payload.accrued.paid_vacation).toEqual([
      { quantity: 5, payment: '250000.00' },
    ])
  })
  it('serializa prima de servicios con paymentNS opcional', () => {
    const payload = buildPayrollPayload({
      ...state,
      lines: [
        { ...state.lines[0], amount: '1500000', quantity: '30' },
        {
          id: 'service-bonus',
          concept: 'service_bonus',
          kind: 'accrued' as const,
          amount: '1500000',
          quantity: '30',
          paymentNS: '100000',
          mapping: 'service_bonus',
        },
      ],
    }, worker, 1, 'SETP')

    expect(payload.accrued.service_bonus).toEqual([
      { quantity: 30, payment: '1500000.00', paymentNS: '100000.00' },
    ])
  })
  it('serializa cesantías con payment, percentage e interest_payment', () => {
    const payload = buildPayrollPayload({
      ...state,
      lines: [
        { ...state.lines[0], amount: '1500000', quantity: '30' },
        {
          id: 'severance',
          concept: 'severance',
          kind: 'accrued' as const,
          amount: '1500000',
          quantity: '30',
          percentage: '12',
          interestPayment: '15000',
          mapping: 'severance',
        },
      ],
    }, worker, 1, 'SETP')

    expect(payload.accrued.severance).toEqual([
      { payment: '1500000.00', percentage: 12, interest_payment: '15000.00' },
    ])
  })
  it('serializa incapacidades laborales con type y fechas', () => {
    const payload = buildPayrollPayload({
      ...state,
      lines: [
        { ...state.lines[0], amount: '1500000', quantity: '30' },
        {
          id: 'work-disability',
          concept: 'disability',
          kind: 'accrued' as const,
          amount: '250000',
          quantity: '5',
          startDate: '2024-01-05',
          endDate: '2024-01-10',
          type: 1,
          mapping: 'disability',
        },
      ],
    }, worker, 1, 'SETP')

    expect(payload.accrued.work_disabilities).toEqual([
      {
        start_date: '2024-01-05',
        end_date: '2024-01-10',
        quantity: 5,
        type: 1,
        payment: '250000.00',
      },
    ])
  })
  it('serializa licencia de maternidad o paternidad con fechas y pago', () => {
    const payload = buildPayrollPayload({
      ...state,
      lines: [
        { ...state.lines[0], amount: '1500000', quantity: '30' },
        {
          id: 'maternity-leave',
          concept: 'parental_leave',
          kind: 'accrued' as const,
          amount: '4500000',
          quantity: '90',
          startDate: '2024-01-01',
          endDate: '2024-04-01',
          mapping: 'maternity_leave',
        },
      ],
    }, worker, 1, 'SETP')

    expect(payload.accrued.maternity_leave).toEqual([
      {
        start_date: '2024-01-01',
        end_date: '2024-04-01',
        quantity: 90,
        payment: '4500000.00',
      },
    ])
  })
  it('serializa licencias remuneradas con fechas y pago', () => {
    const payload = buildPayrollPayload({
      ...state,
      lines: [
        { ...state.lines[0], amount: '1500000', quantity: '30' },
        {
          id: 'paid-leave',
          concept: 'paid_leave',
          kind: 'accrued' as const,
          amount: '100000',
          quantity: '2',
          startDate: '2024-01-01',
          endDate: '2024-01-02',
          mapping: 'paid_leave',
        },
      ],
    }, worker, 1, 'SETP')

    expect(payload.accrued.paid_leave).toEqual([
      {
        start_date: '2024-01-01',
        end_date: '2024-01-02',
        quantity: 2,
        payment: '100000.00',
      },
    ])
  })
  it('serializa licencias no remuneradas con fechas y cantidad', () => {
    const payload = buildPayrollPayload({
      ...state,
      lines: [
        { ...state.lines[0], amount: '1500000', quantity: '30' },
        {
          id: 'unpaid-leave',
          concept: 'unpaid_leave',
          kind: 'accrued' as const,
          amount: '0',
          quantity: '3',
          startDate: '2024-01-01',
          endDate: '2024-01-03',
          mapping: 'non_paid_leave',
        },
      ],
    }, worker, 1, 'SETP')

    expect(payload.accrued.non_paid_leave).toEqual([
      {
        start_date: '2024-01-01',
        end_date: '2024-01-03',
        quantity: 3,
      },
    ])
  })
  it('serializa viáticos salariales y no salariales', () => {
    const payload = buildPayrollPayload({
      ...state,
      lines: [
        { ...state.lines[0], amount: '1500000', quantity: '30' },
        {
          id: 'salary-viatics',
          concept: 'salary_viatics',
          kind: 'accrued' as const,
          amount: '50000',
          quantity: '1',
          mapping: 'salary_viatics',
        },
        {
          id: 'non-salary-viatics',
          concept: 'non_salary_viatics',
          kind: 'accrued' as const,
          amount: '30000',
          quantity: '1',
          mapping: 'non_salary_viatics',
        },
      ],
    }, worker, 1, 'SETP')

    expect(payload.accrued.salary_viatics).toEqual([
      { salary_viatics: 50000 },
    ])
    expect(payload.accrued.non_salary_viatics).toEqual([
      { non_salary_viatics: 30000 },
    ])
  })
  it('serializa bonificaciones salariales y no salariales', () => {
    const payload = buildPayrollPayload({
      ...state,
      lines: [
        { ...state.lines[0], amount: '1500000', quantity: '30' },
        {
          id: 'salary-bonus',
          concept: 'salary_bonus',
          kind: 'accrued' as const,
          amount: '100000',
          quantity: '1',
          mapping: 'salary_bonus',
        },
        {
          id: 'non-salary-bonus',
          concept: 'non_salary_bonus',
          kind: 'accrued' as const,
          amount: '50000',
          quantity: '1',
          mapping: 'non_salary_bonus',
        },
      ],
    }, worker, 1, 'SETP')

    expect(payload.accrued.bonuses).toEqual([
      { salary_bonus: 100000 },
      { non_salary_bonus: 50000 },
    ])
  })
  it('serializa auxilios salariales y no salariales', () => {
    const payload = buildPayrollPayload({
      ...state,
      lines: [
        { ...state.lines[0], amount: '1500000', quantity: '30' },
        {
          id: 'salary-assistance',
          concept: 'salary_assistance',
          kind: 'accrued' as const,
          amount: '50000',
          quantity: '1',
          mapping: 'salary_assistance',
        },
        {
          id: 'non-salary-assistance',
          concept: 'non_salary_assistance',
          kind: 'accrued' as const,
          amount: '30000',
          quantity: '1',
          mapping: 'non_salary_assistance',
        },
      ],
    }, worker, 1, 'SETP')

    expect(payload.accrued.aid).toEqual([
      { salary_assistance: 50000 },
      { non_salary_assistance: 30000 },
    ])
  })
  it('serializa huelga legal con fechas y cantidad', () => {
    const payload = buildPayrollPayload({
      ...state,
      lines: [
        { ...state.lines[0], amount: '1500000', quantity: '30' },
        {
          id: 'legal-strike',
          concept: 'legal_strike',
          kind: 'accrued' as const,
          amount: '0',
          quantity: '2',
          startDate: '2024-01-01',
          endDate: '2024-01-02',
          mapping: 'legal_strike',
        },
      ],
    }, worker, 1, 'SETP')

    expect(payload.accrued.legal_strike).toEqual([
      {
        start_date: '2024-01-01',
        end_date: '2024-01-02',
        quantity: 2,
      },
    ])
  })
  it('serializa otros conceptos devengados con descripción', () => {
    const payload = buildPayrollPayload({
      ...state,
      lines: [
        { ...state.lines[0], amount: '1500000', quantity: '30' },
        {
          id: 'other-concepts',
          concept: 'other_concepts',
          kind: 'accrued' as const,
          amount: '50000',
          quantity: '1',
          formula: 'Bono extralegal',
          mapping: 'other_concepts',
        },
      ],
    }, worker, 1, 'SETP')

    expect(payload.accrued.other_concepts).toEqual([
      {
        salary_concept: 50000,
        non_salary_concept: 0,
        description_concept: 'Bono extralegal',
      },
    ])
  })
  it('serializa compensaciones ordinarias y extraordinarias', () => {
    const payload = buildPayrollPayload({
      ...state,
      lines: [
        { ...state.lines[0], amount: '1500000', quantity: '30' },
        {
          id: 'ordinary-compensation',
          concept: 'ordinary_compensation',
          kind: 'accrued' as const,
          amount: '100000',
          quantity: '1',
          mapping: 'ordinary_compensation',
        },
        {
          id: 'extraordinary-compensation',
          concept: 'extraordinary_compensation',
          kind: 'accrued' as const,
          amount: '50000',
          quantity: '1',
          mapping: 'extraordinary_compensation',
        },
      ],
    }, worker, 1, 'SETP')

    expect(payload.accrued.compensations).toEqual([
      { ordinary_compensation: 100000 },
      { extraordinary_compensation: 50000 },
    ])
  })
  it('serializa bonificaciones EPCTV con pagos salariales y de alimentación', () => {
    const payload = buildPayrollPayload({
      ...state,
      lines: [
        { ...state.lines[0], amount: '1500000', quantity: '30' },
        {
          id: 'epctv-bonuses',
          concept: 'epctv_bonuses',
          kind: 'accrued' as const,
          amount: '50000',
          quantity: '1',
          mapping: 'epctv_bonuses',
        },
      ],
    }, worker, 1, 'SETP')

    expect(payload.accrued.epctv_bonuses).toEqual([
      {
        paymentS: 50000,
        paymentNS: 50000,
        salary_food_payment: 0,
        non_salary_food_payment: 0,
      },
    ])
  })
  it('serializa comisiones', () => {
    const payload = buildPayrollPayload({
      ...state,
      lines: [
        { ...state.lines[0], amount: '1500000', quantity: '30' },
        {
          id: 'commission',
          concept: 'commissions',
          kind: 'accrued' as const,
          amount: '200000',
          quantity: '1',
          mapping: 'commissions',
        },
      ],
    }, worker, 1, 'SETP')

    expect(payload.accrued.commissions).toEqual([
      { commission: 200000 },
    ])
  })
  it('serializa anticipos devengados', () => {
    const payload = buildPayrollPayload({
      ...state,
      lines: [
        { ...state.lines[0], amount: '1500000', quantity: '30' },
        {
          id: 'advance',
          concept: 'advances',
          kind: 'accrued' as const,
          amount: '200000',
          quantity: '1',
          mapping: 'advances',
        },
      ],
    }, worker, 1, 'SETP')

    expect(payload.accrued.advances).toEqual([
      { advance: 200000 },
    ])
  })
  it('serializa dotación', () => {
    const payload = buildPayrollPayload({
      ...state,
      lines: [
        { ...state.lines[0], amount: '1500000', quantity: '30' },
        {
          id: 'endowment',
          concept: 'endowment',
          kind: 'accrued' as const,
          amount: '50000',
          quantity: '1',
          mapping: 'endowment',
        },
      ],
    }, worker, 1, 'SETP')

    expect(payload.accrued.endowment).toEqual([
      { endowment: 50000 },
    ])
  })
  it('serializa apoyo de sostenimiento', () => {
    const payload = buildPayrollPayload({
      ...state,
      lines: [
        { ...state.lines[0], amount: '1500000', quantity: '30' },
        {
          id: 'sustenance-support',
          concept: 'sustenance_support',
          kind: 'accrued' as const,
          amount: '30000',
          quantity: '1',
          mapping: 'sustenance_support',
        },
      ],
    }, worker, 1, 'SETP')

    expect(payload.accrued.sustenance_support).toEqual([
      { sustenance_support: 30000 },
    ])
  })
  it('serializa indemnización', () => {
    const payload = buildPayrollPayload({
      ...state,
      lines: [
        { ...state.lines[0], amount: '1500000', quantity: '30' },
        {
          id: 'compensation',
          concept: 'compensation',
          kind: 'accrued' as const,
          amount: '1000000',
          quantity: '1',
          mapping: 'compensation',
        },
      ],
    }, worker, 1, 'SETP')

    expect(payload.accrued.compensation).toEqual([
      { compensation: 1000000 },
    ])
  })
  it('incluye el total devengado del período', () => {
    const payload = buildPayrollPayload({
      ...state,
      lines: [
        { ...state.lines[0], amount: '1640606', quantity: '30' },
        {
          id: 'deduction',
          concept: 'eps',
          kind: 'deduction' as const,
          amount: '50000',
          quantity: '1',
          percentage: '4',
        },
      ],
    }, worker, 1, 'SETP')

    expect(payload.accrued_total).toBe(1640606)
  })
  it('serializa reintegro', () => {
    const payload = buildPayrollPayload({
      ...state,
      lines: [
        { ...state.lines[0], amount: '1500000', quantity: '30' },
        {
          id: 'refund',
          concept: 'refund',
          kind: 'accrued' as const,
          amount: '20000',
          quantity: '1',
          mapping: 'refund',
        },
      ],
    }, worker, 1, 'SETP')

    expect(payload.accrued.refund).toEqual([
      { refund: 20000 },
    ])
  })
  it('serializa bonificación por retiro', () => {
    const payload = buildPayrollPayload({
      ...state,
      lines: [
        { ...state.lines[0], amount: '1500000', quantity: '30' },
        {
          id: 'retirement-bonus',
          concept: 'retirement_bonus',
          kind: 'accrued' as const,
          amount: '500000',
          quantity: '1',
          mapping: 'withdrawal_bonus',
        },
      ],
    }, worker, 1, 'SETP')

    expect(payload.accrued.withdrawal_bonus).toEqual([
      { withdrawal_bonus: 500000 },
    ])
  })
  it('serializa teletrabajo', () => {
    const payload = buildPayrollPayload({
      ...state,
      lines: [
        { ...state.lines[0], amount: '1500000', quantity: '30' },
        {
          id: 'telecommuting',
          concept: 'telecommuting',
          kind: 'accrued' as const,
          amount: '50000',
          quantity: '1',
          mapping: 'telecommuting',
        },
      ],
    }, worker, 1, 'SETP')

    expect(payload.accrued.telecommuting).toEqual([
      { telecommuting: 50000 },
    ])
  })
  it('serializa pagos a terceros', () => {
    const payload = buildPayrollPayload({
      ...state,
      lines: [
        { ...state.lines[0], amount: '1500000', quantity: '30' },
        {
          id: 'third-party-payment',
          concept: 'third_party_payments',
          kind: 'accrued' as const,
          amount: '100000',
          quantity: '1',
          mapping: 'third_party_payments',
        },
      ],
    }, worker, 1, 'SETP')

    expect(payload.accrued.third_party_payments).toEqual([
      { third_party_payment: 100000 },
    ])
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
  it('separa antigüedad acumulada y días de la quincena sin usar la fecha de emisión', () => {
    const payload = buildPayrollPayload({
      ...state, endDate: '2026-10-15', issueDate: '2026-11-20', workedDays: '15',
      lines: [{ ...state.lines[0], quantity: '15' }],
    }, worker, 1, 'SETP')
    expect(payload.period.worked_time).toBe(285)
    expect(payload.accrued.salary[0].worked_days).toBe('15.00')
  })
})
