import type {
  Concept,
  Employee,
  Parameters,
  PayrollDocument,
  PayrollState,
} from '../../services/payrollService'
import {
  cents,
  money,
  totals,
  validDate,
  validatePayroll,
  type PayrollLine,
} from '../../utils/payrollDomain'
import { payrollEmploymentDays } from '../../utils/payrollEmployment'
import { prorate } from '../../utils/payrollDomain'

export const canEditPayrollNovelties = (document: Pick<PayrollDocument, 'status'>) =>
  ['DRAFT', 'REJECTED'].includes(document.status)

export function preparePayrollNovelties(state: PayrollState): PayrollState {
  return { ...state, lines: state.lines.map(line => ({ ...line, manual: true, formula: undefined })) }
}

export function payrollNoveltyDateBounds(period: string) {
  const [year, month] = period.split('-').map(Number)
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return { min: `${period}-01`, max: `${period}-${String(lastDay).padStart(2, '0')}` }
}

export function payrollNoveltyDateQuantity(startDate: string, endDate: string, nonWorkingDays = '0'): string {
  if (!validDate(startDate) || !validDate(endDate) || startDate > endDate)
    throw new Error('Revisa la fecha de inicio y la fecha de fin de la novedad.')
  const totalDays = (Date.parse(endDate) - Date.parse(startDate)) / 86400000 + 1
  if (!/^\d+$/.test(nonWorkingDays) || !Number.isSafeInteger(Number(nonWorkingDays)) || Number(nonWorkingDays) >= totalDays)
    throw new Error('Los días no hábiles deben ser un número entero entre cero y uno menos que los días del rango.')
  return String(totalDays - Number(nonWorkingDays))
}

export function payrollNoveltyLine(
  state: PayrollState,
  concept: Concept,
  input: {
    id: string
    quantity: string
    amount: string
    percentage: string
    manual: boolean
    formula?: string
    startDate?: string
    endDate?: string
    nonWorkingDays?: string
    startTime?: string
    endTime?: string
    type?: number
    paymentNS?: string
    interestPayment?: string
    overtimeType?: 'normal' | 'night' | 'holiday'
    overtimeSurchargeId?: number
  },
): PayrollLine {
  const bounds = payrollNoveltyDateBounds(state.period)
  if ([input.startDate, input.endDate].some(date => date && (date < bounds.min || date > bounds.max)))
    throw new Error('Las fechas de la novedad deben estar dentro del mes de la nómina.')
  if (cents(input.amount) <= 0n || cents(input.quantity) <= 0n)
    throw new Error('La cantidad y el valor deben ser mayores que cero.')
  const line: PayrollLine = {
    ...input,
    concept: concept.code,
    kind: concept.kind,
    mapping: concept.code.startsWith('internal_')
      ? concept.category
      : concept.code,
  }
  const next = {
    ...state,
    lines: [...state.lines.filter((item) => item.id !== line.id), line],
  }
  if (next.lines.filter((item) => item.concept === 'salary').length > 1)
    throw new Error(
      'El salario básico ya está incluido. Edita la novedad existente.',
    )
  const errors = validatePayroll(next, undefined).filter(
    (error) => error !== 'Selecciona un empleado de esta empresa.',
  )
  if (errors.length) throw new Error(errors.join(' '))
  return line
}

export function payrollNoveltyTotals(documents: Pick<PayrollDocument, 'state'>[]) {
  const sums = documents.reduce(
    (sum, document) => {
      const value = totals(document.state.lines)
      return {
        accrued: sum.accrued + cents(value.accrued),
        deductions: sum.deductions + cents(value.deductions),
      }
    },
    { accrued: 0n, deductions: 0n },
  )
  return {
    accrued: money(sums.accrued),
    deductions: money(sums.deductions),
    net: money(sums.accrued - sums.deductions),
  }
}

export function stateForAddedPayrollEmployee(
  reference: PayrollState,
  employee: Employee,
  parameters: Parameters,
): PayrollState {
  const employment = payrollEmploymentDays(reference, employee)
  if (employment.days <= 0)
    throw new Error('El empleado no tiene días de vinculación en este período.')
  const fullDays =
    reference.periodicity === 'MONTHLY'
      ? parameters.monthlyDays
      : prorate(parameters.monthlyDays, '1', '2')
  const workedDays =
    employment.days === employment.periodDays
      ? fullDays
      : prorate(
          fullDays,
          String(employment.days),
          String(employment.periodDays),
        )
  return {
    ...reference,
    employeeId: employee.id,
    workedDays,
    lines: [],
  }
}
