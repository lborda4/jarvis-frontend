import { cents, money, prorate } from './payrollDomain'
import type { Concept, Employee, Parameters } from '../services/payrollService'
export function suggestPayrollAmount(
  employee: Employee,
  parameters: Parameters,
  concept: Concept,
  quantity: string,
  workedDays: string,
): { amount: string; formula: string } | null {
  if (concept.code === 'salary')
    return {
      amount: prorate(employee.salary, workedDays, parameters.monthlyDays),
      formula: `${employee.salary} / ${parameters.monthlyDays} días × ${workedDays} días`,
    }
  if (concept.code === 'transportation_allowance') return null // Eligibility cannot be inferred from salary alone.
  if (
    concept.base === 'manual' ||
    employee.contractType === 'APPRENTICE' ||
    employee.integralSalary ||
    employee.highRiskPension
  )
    return null
  if (concept.base === 'hourly' && concept.factor) {
    const divisor = cents(parameters.monthlyHours) * 100n
    if (divisor <= 0n) return null
    const applied =
      cents(concept.factor) -
      (concept.calculationMode === 'additional' ? 100n : 0n)
    if (applied < 0n) return null
    const amount = money(
      (cents(employee.salary) * cents(quantity) * applied + divisor / 2n) /
        divisor,
    )
    return {
      amount,
      formula: `${employee.salary} / ${parameters.monthlyHours} horas × ${quantity} × ${concept.calculationMode === 'additional' ? 'recargo adicional' : 'factor total'} ${money(applied)}`,
    }
  }
  if (concept.base === 'salary' && concept.percentage) {
    const base = prorate(employee.salary, workedDays, parameters.monthlyDays)
    return {
      amount: money((cents(base) * cents(concept.percentage) + 5000n) / 10000n),
      formula: `Base ${base} × ${concept.percentage} %`,
    }
  }
  return null
}
