import type { PayrollMonth } from './payrollMonths'

export function payrollMonthlySendQueue(
  employees: PayrollMonth['employees'],
  selectedIds?: readonly string[],
  attempts: Record<string, { status: string }> = {},
) {
  const selected = selectedIds && new Set(selectedIds)
  const reserved = ['ACCEPTED', 'PROCESSING', 'UNCERTAIN']
  return employees.filter(employee => (!selected || selected.has(employee.id)) &&
    !reserved.includes(employee.submission?.status ?? '') &&
    !reserved.includes(attempts[employee.id]?.status ?? '') &&
    !employee.documents.some(document => !document.monthlySubmission &&
      (document.number || document.cune || reserved.includes(document.sourceStatus ?? document.status))))
}
