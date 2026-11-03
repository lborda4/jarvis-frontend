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
  validatePayroll,
  type PayrollLine,
} from '../../utils/payrollDomain'
import { suggestPayrollAmount } from '../../utils/payrollCalculation'
import { payrollEmploymentDays } from '../../utils/payrollEmployment'
import { prorate } from '../../utils/payrollDomain'

export const canEditPayrollNovelties = (document: Pick<PayrollDocument, 'status'>) =>
  ['DRAFT', 'REJECTED'].includes(document.status)

export function recalculatePayrollNovelties(
  state: PayrollState,
  employee: Employee,
  parameters: Parameters,
): PayrollState {
  return {
    ...state,
    lines: state.lines.map((line) => {
      if (line.manual) return line
      const concept = parameters.concepts.find(
        (item) => item.code === line.concept && item.kind === line.kind,
      )
      if (!concept) return line
      const result = suggestPayrollAmount(
        employee,
        parameters,
      { ...concept, percentage: line.percentage ?? concept.percentage },
        line.quantity,
        state.workedDays,
      )
      return result
        ? { ...line, amount: result.amount, formula: result.formula }
        : line
    }),
  }
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
  },
): PayrollLine {
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
  const salary = parameters.concepts.find(
    (item) => item.code === 'salary' && item.active,
  )
  if (!salary)
    throw new Error('Activa el concepto de salario básico en configuración.')
  return {
    ...reference,
    employeeId: employee.id,
    workedDays,
    lines: [
      {
        id: crypto.randomUUID(),
        concept: 'salary',
        kind: 'accrued',
        quantity: workedDays,
        amount: prorate(employee.salary, workedDays, parameters.monthlyDays),
        manual: false,
        formula: `${employee.salary} / ${parameters.monthlyDays} días × ${workedDays} días`,
      },
    ],
  }
}
