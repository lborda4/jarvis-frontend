export interface SubscriptionAccess {
  provider: 'SIIGO' | 'JARVIS'
  startsAt: string | null
  expiresAt: string | null
  expired: boolean
  notStarted: boolean
  canWrite: boolean
  daysRemaining: number | null
  status: string | null
}

let snapshot: { companyId: string; items: SubscriptionAccess[] } | null = null
export const saveSubscriptionAccess = (companyId: string, items: SubscriptionAccess[]) => { snapshot = { companyId, items } }
export const clearSubscriptionAccess = (companyId: string) => { if (snapshot?.companyId === companyId) snapshot = null }
export function subscriptionIsReadOnly(access: SubscriptionAccess, now = Date.now()) {
  return !access.canWrite || Boolean(access.expiresAt && now >= Date.parse(access.expiresAt))
}
export function isSubscriptionMutation(method: string, path: string) {
  if (['get', 'head', 'options'].includes(method.toLowerCase())) return false
  path = path.split('?')[0].replace(/\/+$/, '')
  if (/^\/integrations\/jarvis\/(radian\/note-eligibility|terceros\/lookup-nit)$/.test(path)) return false
  return /^\/(integrations|invoices|electronic-documents|products|payroll|import-sessions?|dian|bank-statements)(\/|$)/.test(path)
}
export function blockedSubscriptionRequest(companyId: string | null, method: string, path: string): string | null {
  if (!companyId || snapshot?.companyId !== companyId || !isSubscriptionMutation(method, path)) return null
  const provider = path.startsWith('/integrations/jarvis') || path.startsWith('/payroll') ? 'JARVIS'
    : path.startsWith('/integrations/siigo') ? 'SIIGO' : snapshot.items.some(item => item.provider === 'SIIGO') ? 'SIIGO' : 'JARVIS'
  const access = snapshot.items.find(item => item.provider === provider)
  return access && subscriptionIsReadOnly(access) ? `La suscripción ${provider} está vencida o inactiva. Solo puedes consultar documentos.` : null
}
