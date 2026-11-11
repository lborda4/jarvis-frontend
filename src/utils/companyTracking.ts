import type { AdminCompanyListItem, AdminIntegrationItem } from '../types/admin'

export function trackingBillingMonths(company: Pick<AdminCompanyListItem, 'billingMonths' | 'billingCycle'>): number | null {
  return company.billingMonths ?? (company.billingCycle === 'ANNUAL' ? 12 : company.billingCycle === 'MONTHLY' ? 1 : null)
}

export function trackingPeriodLabel(company: Pick<AdminCompanyListItem, 'billingMonths' | 'billingCycle'>): string {
  const months = trackingBillingMonths(company)
  return months === null ? 'Sin definir' : `${months} ${months === 1 ? 'mes' : 'meses'}`
}

export function trackingDocumentBalance(integration: AdminIntegrationItem): string {
  const quota = integration.documentQuota
  if (!quota) return '—'
  if (quota.remaining === null) return 'Sin límite'
  return Math.max(0, quota.remaining).toLocaleString('es-CO')
}

export type TrackingStatus = 'CURRENT' | 'DUE_SOON' | 'DUE_TODAY' | 'OVERDUE' | 'UNCONFIGURED'
export const TRACKING_STATUS_LABELS: Record<TrackingStatus, string> = {
  CURRENT: 'Activo', DUE_SOON: 'Por vencer', DUE_TODAY: 'Vence hoy', OVERDUE: 'Vencido', UNCONFIGURED: 'Sin configurar',
}
export function trackingRenewalDueDate(company: Pick<AdminCompanyListItem, 'subscriptionDueDate'>, months: number, today = colombiaToday()): string | null {
  if (!Number.isInteger(months) || months < 1 || months > 1200) return null
  const base = company.subscriptionDueDate && company.subscriptionDueDate > today ? company.subscriptionDueDate : today
  const date = new Date(`${base}T12:00:00Z`)
  if (!Number.isFinite(date.getTime())) return null
  const first = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1))
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate()
  first.setUTCDate(Math.min(date.getUTCDate(), last))
  return first.toISOString().slice(0, 10)
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
