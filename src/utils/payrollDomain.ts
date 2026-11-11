import { payrollWorkedTime } from './payrollEmployment'
import { overtimeDefinition, overtimeErrors } from './payrollOvertime'

/** Monetary values are decimal strings; integer arithmetic avoids binary rounding. */
export function cents(value: unknown): bigint {
  const text = String(value ?? '')
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(text))
    throw new Error('Ingresa un valor positivo con máximo dos decimales.')
  const [whole, fraction = ''] = text.split('.')
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))
}
export function money(value: bigint): string {
  const sign = value < 0n ? '-' : ''
  const absolute = value < 0n ? -value : value
  return `${sign}${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`
}
export function prorate(
  amount: string,
  quantity: string,
  divisor: string,
): string {
  const base = cents(amount),
    units = cents(quantity),
    reference = cents(divisor)
  if (reference <= 0n)
    throw new Error('Configura una base de cálculo mayor que cero.')
  return money((base * units + reference / 2n) / reference)
}
export interface PayrollLine {
  id: string
  concept: string
  kind: 'accrued' | 'deduction'
  amount: string
  quantity: string
  percentage?: string
  paymentNS?: string
  interestPayment?: string
  startDate?: string
  endDate?: string
  type?: number
  nonWorkingDays?: string
  startTime?: string
  endTime?: string
  overtimeType?: 'normal' | 'night' | 'holiday'
  overtimeSurchargeId?: number
  formula?: string
  manual?: boolean
  mapping?: string
}
export type PayrollDeductionEntry = {
  payment: string
  percentage: string
}

export type PayrollDeductions = Record<string, PayrollDeductionEntry | string | number | undefined> & {
  eps?: PayrollDeductionEntry
  pension?: PayrollDeductionEntry
  eps_type_law_deductions_id?: number
  eps_deduction?: number
  pension_type_law_deductions_id?: number
  pension_deduction?: number
  deductions_total?: number
}

export interface PayrollInput {
  period: string
  startDate: string
  endDate: string
  issueDate: string
  workedDays: string
  lines: PayrollLine[]
  noteType?: number
}
export interface PayrollWorker {
  firstName: string
  surname: string
  secondName?: string
  secondSurname?: string
  identification: string
  salary: string
  admittanceDate: string
  retirementDate?: string
  active?: boolean
  paymentMethodId: number
  typeWorkerId: number
  subTypeWorkerId: number
  documentTypeId: number
  highRiskPension?: boolean
  integralSalary?: boolean
  bankName?: string
  accountType?: string
  accountNumber?: string
}
export const VERIFIED_CONCEPTS = [
  'salary',
  'transportation_allowance',
  'eps',
  'pension',
  'overtime_day',
  'overtime_night',
  'vacation_paid',
  'paid_vacation',
  'service_bonus',
  'premium',
  'severance',
  'retirement_bonus',
  'refund',
  'disability',
  'parental_leave',
  'maternity_leave',
  'compensation',
  'paid_leave',
  'unpaid_leave',
  'non_paid_leave',
  'salary_bonus',
  'non_salary_bonus',
  'salary_viatics',
  'non_salary_viatics',
  'salary_assistance',
  'non_salary_assistance',
  'legal_strike',
  'other_concepts',
  'ordinary_compensation',
  'extraordinary_compensation',
  'epctv_bonuses',
  'commissions',
  'advances',
  'endowment',
  'sustenance_support',
  'telecommuting',
  'withdrawal_bonus',
  'third_party_payments',
]
export function totals(lines: PayrollLine[]) {
  let accrued = 0n,
    deductions = 0n
  for (const line of lines) {
    if (line.kind === 'accrued') accrued += cents(line.amount)
    else if (line.kind === 'deduction') deductions += cents(line.amount)
    else throw new Error('Naturaleza del concepto inválida.')
  }
  return {
    accrued: money(accrued),
    deductions: money(deductions),
    net: money(accrued - deductions),
  }
}
export function validDate(value: string): boolean {
  const date = new Date(value)
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value ?? '') &&
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  )
}
export function validatePayroll(
  state: PayrollInput,
  employee: PayrollWorker | null | undefined,
  transmission = false,
): string[] {
  const errors: string[] = []
  if (employee) {
    try {
      payrollWorkedTime(state.endDate, employee)
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Revisa el tiempo laborado.')
    }
  }
  if (!employee) errors.push('Selecciona un empleado de esta empresa.')
  if (
    !validDate(state.startDate) ||
    !validDate(state.endDate) ||
    state.startDate > state.endDate
  )
    errors.push('Revisa las fechas del período.')
  if (!validDate(state.issueDate)) errors.push('Revisa la fecha de emisión.')
  if (
    !/^\d{4}-\d{2}$/.test(state.period ?? '') ||
    state.startDate?.slice(0, 7) !== state.period ||
    state.endDate?.slice(0, 7) !== state.period
  )
    errors.push('El período debe coincidir con las fechas de liquidación.')
  if (!Array.isArray(state.lines) || (transmission && !state.lines.length))
    errors.push('Agrega al menos un devengado.')
  else if (state.lines.length) {
    if (state.lines.some((l: PayrollLine) => !l || typeof l !== 'object'))
      return ['Revisa los conceptos de nómina.']
    try {
      const total = totals(state.lines)
      if (total.net.startsWith('-'))
        errors.push('Las deducciones superan los devengados.')
    } catch {
      errors.push('Revisa los valores de los conceptos.')
    }
    if (!state.lines.some((l: PayrollLine) => l.kind === 'accrued'))
      errors.push('Agrega un devengado.')
    if (
      transmission &&
      state.lines.some(
        (l: PayrollLine) => !VERIFIED_CONCEPTS.includes(l.mapping ?? l.concept),
      )
    )
      errors.push('Hay conceptos pendientes de integración con NextPyme.')
    if (
      state.lines.some((l: PayrollLine) =>
        ['eps', 'pension'].includes(l.mapping ?? l.concept)
          ? l.kind !== 'deduction'
          : VERIFIED_CONCEPTS.includes(l.mapping ?? l.concept) &&
            l.kind !== 'accrued',
      )
    )
      errors.push('La naturaleza de un concepto es incorrecta.')
    for (const line of state.lines as PayrollLine[]) {
      errors.push(...overtimeErrors(line, state.period))
      try {
        if (cents(line.quantity) < 0n) errors.push('Cantidad inválida.')
        if (line.percentage !== undefined && cents(line.percentage) > 10000n)
          errors.push('Porcentaje fuera de rango.')
        if (
          transmission &&
          ['eps', 'pension'].includes(line.mapping ?? line.concept) &&
          cents(line.amount) > 0n &&
          cents(line.percentage ?? '0') === 0n
        )
          errors.push(
            'Completa el porcentaje de salud y pensión antes de transmitir.',
          )
        if (
          transmission &&
          ['salary', 'transportation_allowance'].includes(
            line.mapping ?? line.concept,
          ) &&
          cents(line.quantity) === 0n
        )
          errors.push('Completa los días de salario y auxilio de transporte.')
        if (
          transmission &&
          ['disability'].includes(line.mapping ?? line.concept) &&
          (line.type === undefined || line.type <= 0)
        )
          errors.push('Completa el tipo de incapacidad.')
      } catch {
        errors.push('Revisa cantidades y porcentajes.')
      }
      if (
        (line.startDate || line.endDate) &&
        (!validDate(line.startDate ?? '') ||
          !validDate(line.endDate ?? '') ||
          line.startDate! > line.endDate!)
      )
        errors.push('Revisa las fechas de las novedades.')
    }
  }
  try {
    if (cents(state.workedDays) <= 0n || cents(state.workedDays) > 3100n)
      errors.push('Revisa los días trabajados.')
  } catch {
    errors.push('Revisa los días trabajados.')
  }
  if (employee && employee.active === false && transmission)
    errors.push('El empleado está inactivo.')
  if (employee && state.endDate < employee.admittanceDate)
    errors.push('El período termina antes del ingreso del empleado.')
  if (
    transmission &&
    (!employee?.paymentMethodId ||
      !employee?.typeWorkerId ||
      !employee?.subTypeWorkerId)
  )
    errors.push('Completa los datos de pago y trabajador.')
  if (transmission && (employee?.secondName || employee?.secondSurname))
    errors.push(
      'El envío de segundos nombres y apellidos está pendiente de verificar en el esquema completo de NextPyme. Se conservan en el empleado.',
    )
  if (employee?.retirementDate && state.startDate > employee.retirementDate)
    errors.push('El período comienza después del retiro del empleado.')
  return [...new Set(errors)]
}
export function buildPayrollPayload(
  state: PayrollInput,
  worker: PayrollWorker,
  number: number,
  prefix: string,
  predecessor?: {
    predecessor_number: string
    predecessor_cune: string
    predecessor_issue_date: string
  },
) {
  const errors = validatePayroll(state, worker, true)
  if (errors.length) throw new Error(errors.join(' '))
  const accrued: Record<string, Record<string, string | number>[]> =
      {},
    deductions: PayrollDeductions = {},
    accruedTotal = state.lines
      .filter((line: PayrollLine) => line.kind === 'accrued')
      .reduce((sum, line) => sum + cents(line.amount), 0n),
    deductionsTotal = state.lines
      .filter((line: PayrollLine) => line.kind === 'deduction')
      .reduce((sum, line) => sum + cents(line.amount), 0n)
  for (const line of state.lines as PayrollLine[]) {
    const key = line.mapping ?? line.concept
    const overtime = overtimeDefinition(key)
    if (overtime)
      (accrued[overtime.bodyKey] ??= []).push({ start_time: line.startTime!, end_time: line.endTime!, quantity: Number(line.quantity), percentage: line.overtimeSurchargeId!, payment: money(cents(line.amount)) })
    else if (line.kind === 'accrued') {
      if (['vacation_paid', 'paid_vacation'].includes(key)) {
        (accrued.paid_vacation ??= []).push({
          quantity: Number(line.quantity),
          payment: money(cents(line.amount)),
        })
        continue
      }
      if (['service_bonus', 'premium'].includes(key)) {
        const payload = {
          quantity: Number(line.quantity),
          payment: money(cents(line.amount)),
        } as { quantity: number; payment: string; paymentNS?: string }
        if (line.paymentNS) payload.paymentNS = money(cents(line.paymentNS))
        ;(accrued.service_bonus ??= []).push(payload)
        continue
      }
      if (['severance'].includes(key)) {
        (accrued.severance ??= []).push({
          payment: money(cents(line.amount)),
          percentage: Number(line.percentage ?? '0'),
          interest_payment: money(cents(line.interestPayment ?? '0')),
        })
        continue
      }
      if (['disability'].includes(key)) {
        (accrued.work_disabilities ??= []).push({
          start_date: line.startDate ?? '',
          end_date: line.endDate ?? '',
          quantity: Number(line.quantity),
          type: Number(line.type ?? 0),
          payment: money(cents(line.amount)),
        })
        continue
      }
      if (['parental_leave', 'maternity_leave'].includes(key)) {
        (accrued.maternity_leave ??= []).push({
          start_date: line.startDate ?? '',
          end_date: line.endDate ?? '',
          quantity: Number(line.quantity),
          payment: money(cents(line.amount)),
        })
        continue
      }
      if (['paid_leave'].includes(key)) {
        (accrued.paid_leave ??= []).push({
          start_date: line.startDate ?? '',
          end_date: line.endDate ?? '',
          quantity: Number(line.quantity),
          payment: money(cents(line.amount)),
        })
        continue
      }
      if (['unpaid_leave', 'non_paid_leave'].includes(key)) {
        (accrued.non_paid_leave ??= []).push({
          start_date: line.startDate ?? '',
          end_date: line.endDate ?? '',
          quantity: Number(line.quantity),
        })
        continue
      }
      if (['salary_viatics'].includes(key)) {
        ;(accrued.salary_viatics ??= []).push({
          salary_viatics: Number(money(cents(line.amount)).replace(/[^\d.]/g, '')),
        })
        continue
      }
      if (['non_salary_viatics'].includes(key)) {
        ;(accrued.non_salary_viatics ??= []).push({
          non_salary_viatics: Number(money(cents(line.amount)).replace(/[^\d.]/g, '')),
        })
        continue
      }
      if (['salary_bonus', 'non_salary_bonus'].includes(key)) {
        const bonusKey = key === 'salary_bonus' ? 'salary_bonus' : 'non_salary_bonus'
        ;(accrued.bonuses ??= []).push({
          [bonusKey]: Number(money(cents(line.amount)).replace(/[^\d.]/g, '')),
        } as Record<string, number>)
        continue
      }
      if (['salary_assistance', 'non_salary_assistance'].includes(key)) {
        const aidKey = key === 'salary_assistance' ? 'salary_assistance' : 'non_salary_assistance'
        ;(accrued.aid ??= []).push({
          [aidKey]: Number(money(cents(line.amount)).replace(/[^\d.]/g, '')),
        } as Record<string, number>)
        continue
      }
      if (['legal_strike'].includes(key)) {
        (accrued.legal_strike ??= []).push({
          start_date: line.startDate ?? '',
          end_date: line.endDate ?? '',
          quantity: Number(line.quantity),
        })
        continue
      }
      if (['other_concepts'].includes(key)) {
        const description = (line.formula ?? line.concept ?? '').trim() || 'Concepto adicional'
        ;(accrued.other_concepts ??= []).push({
          salary_concept: Number(money(cents(line.amount)).replace(/[^\d.]/g, '')),
          non_salary_concept: 0,
          description_concept: description,
        })
        continue
      }
      if (['ordinary_compensation', 'extraordinary_compensation'].includes(key)) {
        const compensationKey = key === 'ordinary_compensation' ? 'ordinary_compensation' : 'extraordinary_compensation'
        ;(accrued.compensations ??= []).push({
          [compensationKey]: Number(money(cents(line.amount)).replace(/[^\d.]/g, '')),
        } as Record<string, number>)
        continue
      }
      if (['epctv_bonuses'].includes(key)) {
        ;(accrued.epctv_bonuses ??= []).push({
          paymentS: Number(money(cents(line.amount)).replace(/[^\d.]/g, '')),
          paymentNS: Number(money(cents(line.amount)).replace(/[^\d.]/g, '')),
          salary_food_payment: 0,
          non_salary_food_payment: 0,
        })
        continue
      }
      if (['commissions'].includes(key)) {
        ;(accrued.commissions ??= []).push({
          commission: Number(money(cents(line.amount)).replace(/[^\d.]/g, '')),
        })
        continue
      }
      if (['advances'].includes(key)) {
        ;(accrued.advances ??= []).push({
          advance: Number(money(cents(line.amount)).replace(/[^\d.]/g, '')),
        })
        continue
      }
      if (['endowment'].includes(key)) {
        ;(accrued.endowment ??= []).push({
          endowment: Number(money(cents(line.amount)).replace(/[^\d.]/g, '')),
        })
        continue
      }
      if (['sustenance_support'].includes(key)) {
        ;(accrued.sustenance_support ??= []).push({
          sustenance_support: Number(money(cents(line.amount)).replace(/[^\d.]/g, '')),
        })
        continue
      }
      if (['telecommuting'].includes(key)) {
        ;(accrued.telecommuting ??= []).push({
          telecommuting: Number(money(cents(line.amount)).replace(/[^\d.]/g, '')),
        })
        continue
      }
      if (['retirement_bonus', 'withdrawal_bonus'].includes(key)) {
        ;(accrued.withdrawal_bonus ??= []).push({
          withdrawal_bonus: Number(money(cents(line.amount)).replace(/[^\d.]/g, '')),
        })
        continue
      }
      if (['compensation'].includes(key)) {
        ;(accrued.compensation ??= []).push({
          compensation: Number(money(cents(line.amount)).replace(/[^\d.]/g, '')),
        })
        continue
      }
      if (['refund'].includes(key)) {
        ;(accrued.refund ??= []).push({
          refund: Number(money(cents(line.amount)).replace(/[^\d.]/g, '')),
        })
        continue
      }
      if (['third_party_payments'].includes(key)) {
        ;(accrued.third_party_payments ??= []).push({
          third_party_payment: Number(money(cents(line.amount)).replace(/[^\d.]/g, '')),
        })
        continue
      }
      (accrued[key] ??= []).push({
        payment: money(cents(line.amount)),
        worked_days: money(cents(line.quantity)),
      })
    } else {
      const previous = deductions[key]
      const previousEntry = typeof previous === 'object' && previous !== null ? previous : undefined
      if (
        previousEntry &&
        previousEntry.percentage !== money(cents(line.percentage ?? '0'))
      )
        throw new Error(
          'Agrupa las deducciones del mismo concepto con el mismo porcentaje.',
        )
      deductions[key] = {
        payment: money(
          cents(line.amount) + (previousEntry ? cents(previousEntry.payment) : 0n),
        ),
        percentage: money(cents(line.percentage ?? '0')),
      }
    }
  }
  const normalizedDeductions: PayrollDeductions = {
    ...deductions,
    ...(deductions.eps
      ? {
          eps_type_law_deductions_id: 1,
          eps_deduction: Number(money(cents(deductions.eps.payment))),
        }
      : {}),
    ...(deductions.pension
      ? {
          pension_type_law_deductions_id: 2,
          pension_deduction: Number(money(cents(deductions.pension.payment))),
        }
      : {}),
    ...(deductions.eps || deductions.pension
      ? { deductions_total: Number(money(deductionsTotal)) }
      : {}),
  }

  return {
    type_document_id: predecessor ? 10 : 9,
    ...(predecessor
      ? { type_note: state.noteType, predecessor }
      : { predecessor: {} }),
    number,
    prefix,
    period: {
      admision_date: worker.admittanceDate,
      settlement_start_date: state.startDate,
      settlement_end_date: state.endDate,
      worked_time: payrollWorkedTime(state.endDate, worker),
      issue_date: state.issueDate,
    },
    worker: {
      type_worker_id: worker.typeWorkerId,
      sub_type_worker_id: worker.subTypeWorkerId,
      type_document_identification_id: worker.documentTypeId,
      identification_number: worker.identification,
      surname: worker.surname,
      first_name: worker.firstName,
      high_risk_pension: false,
      integral_salary: !!worker.integralSalary,
      salary: money(cents(worker.salary)),
    },
    payment: {
      payment_method_id: worker.paymentMethodId,
      ...(worker.bankName
        ? {
            bank_name: worker.bankName,
            account_type: worker.accountType,
            account_number: worker.accountNumber,
          }
        : {}),
    },
    accrued_total: Number(money(accruedTotal)),
    accrued,
    deductions: normalizedDeductions,
  }
}
