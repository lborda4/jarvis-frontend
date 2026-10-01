import type { AdminCompanyListItem } from '../types/admin'

export type TrackingStatus = 'CURRENT' | 'DUE_SOON' | 'DUE_TODAY' | 'OVERDUE' | 'UNCONFIGURED'
export const TRACKING_STATUS_LABELS: Record<TrackingStatus, string> = {
  CURRENT: 'Al día', DUE_SOON: 'Por vencer', DUE_TODAY: 'Vence hoy', OVERDUE: 'Vencido', UNCONFIGURED: 'Sin configurar',
}
export function colombiaToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const part = (type: string) => parts.find(value => value.type === type)?.value
  return `${part('year')}-${part('month')}-${part('day')}`
}
export function companyTrackingStatus(company: Pick<AdminCompanyListItem, 'subscriptionDueDate'>, today: string): TrackingStatus {
  if (!company.subscriptionDueDate) return 'UNCONFIGURED'
  const days = Math.round((Date.parse(company.subscriptionDueDate) - Date.parse(today)) / 86400000)
  if (!Number.isFinite(days)) return 'UNCONFIGURED'
  return days < 0 ? 'OVERDUE' : days === 0 ? 'DUE_TODAY' : days <= 7 ? 'DUE_SOON' : 'CURRENT'
}
export function trackingCsvCell(value: string): string {
  const safe = /^[\s]*[=+@-]/.test(value) ? `'${value}` : value
  return `"${safe.replace(/"/g, '""')}"`
}
