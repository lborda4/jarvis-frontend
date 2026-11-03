import type { PayrollDocument } from '../../services/payrollService'
import { cents, money } from '../../utils/payrollDomain'
import { employeeName, statusLabels } from './payrollDefaults'
import { groupPayrollPeriods, payrollPeriodKey } from './payrollPeriods'

export function filterPayrollList(
  documents: PayrollDocument[],
  search: string,
  status: string,
) {
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es')
  const query = normalize(search.trim())
  const periodText = new Map(
    groupPayrollPeriods(documents).map((group) => [
      group.key,
      normalize(`${group.label} ${group.monthLabel} ${group.period} ${group.type} ${group.start} ${group.end}`),
    ]),
  )
  return documents.filter(
    (document) =>
      (!status || document.status === status) &&
      (!query ||
        periodText.get(payrollPeriodKey(document))?.includes(query) ||
        normalize(`${employeeName(document.employee)} ${document.employee.identification} ${document.prefix ?? ''}${document.number ?? ''}`)
          .includes(query)),
  )
}

export function payrollListTotals(documents: PayrollDocument[]) {
  const accrued = documents.reduce(
    (sum, document) => sum + cents(document.accrued),
    0n,
  )
  const deductions = documents.reduce(
    (sum, document) => sum + cents(document.deductions),
    0n,
  )
  return {
    accrued: money(accrued),
    deductions: money(deductions),
    net: money(accrued - deductions),
    employees: new Set(documents.map((document) => document.employeeId)).size,
  }
}

export function payrollListStatusOptions(documents: Pick<PayrollDocument, 'status'>[]) {
  const present = new Set(documents.map(document => document.status))
  const ordered = [...Object.keys(statusLabels).filter(status => present.has(status)),
    ...[...present].filter(status => !(status in statusLabels)).sort()]
  return ordered.map(value => ({ value, label: statusLabels[value] ?? value }))
}
