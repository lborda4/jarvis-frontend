import type { PayrollDocument } from '../../services/payrollService'
import { cents, money } from '../../utils/payrollDomain'
import { statusLabels } from './payrollDefaults'

export function periodLabel(period: string): string {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) return period
  const label = new Intl.DateTimeFormat('es-CO', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${period}-01T12:00:00Z`))
  return label.charAt(0).toUpperCase() + label.slice(1).replace(' de ', ' ')
}
export function liquidationType(start: string, end: string): string {
  if (start.slice(0, 7) !== end.slice(0, 7)) return 'Personalizada'
  const [year, month] = start.split('-').map(Number)
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate()
  if (start.endsWith('-01') && end.endsWith('-15')) return 'Quincenal 1'
  if (start.endsWith('-16') && Number(end.slice(-2)) === last)
    return 'Quincenal 2'
  if (start.endsWith('-01') && Number(end.slice(-2)) === last) return 'Mensual'
  return 'Personalizada'
}
export function payrollPeriodKey(document: PayrollDocument): string {
  return `${document.state.startDate}|${document.state.endDate}${document.state.payrollGroupId ? `|${document.state.payrollGroupId}` : ''}`
}
export function groupPayrollPeriods(documents: PayrollDocument[]) {
  const groups = new Map<string, PayrollDocument[]>()
  for (const document of documents) {
    const key = payrollPeriodKey(document)
    const group = groups.get(key) ?? []
    group.push(document)
    groups.set(key, group)
  }
  return [...groups]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, items]) => {
      const [start, end] = key.split('|')
      const statuses = new Set(items.map((d) => d.status))
      const status =
        statuses.size === 1
          ? items[0].status
          : statuses.has('REJECTED')
            ? 'REJECTED'
            : 'PROCESSING'
      const label =
        statuses.size === 1
          ? statusLabels[status]
          : status === 'REJECTED'
            ? 'Con rechazos'
            : 'En proceso'
      const total = (field: 'accrued' | 'deductions' | 'net') =>
        money(items.reduce((sum, d) => sum + cents(d[field]), 0n))
      return {
        key,
        start,
        end,
        period: start.slice(0, 7),
        label:
          items[0].state.payrollName?.trim() || periodLabel(start.slice(0, 7)),
        monthLabel: periodLabel(start.slice(0, 7)),
        type: liquidationType(start, end),
        employees: new Set(items.map((d) => d.employeeId)).size,
        accrued: total('accrued'),
        deductions: total('deductions'),
        net: total('net'),
        status,
        statusLabel: label,
      }
    })
}
