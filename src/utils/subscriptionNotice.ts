import type { SubscriptionAccess } from '../services/subscriptionAccessStore'

export function subscriptionNotice(access: SubscriptionAccess, now = new Date()) {
  if (!access.expiresAt) return null
  const end = new Date(access.expiresAt)
  if (!Number.isFinite(end.getTime())) return null
  const jarvis = access.provider === 'JARVIS'
  if (now >= end) return { variant: 'error' as const, title: jarvis ? 'Certificado digital vencido' : 'Suscripción SIIGO vencida',
    message: jarvis ? 'Puedes consultar tus documentos, pero no enviarlos. Comunícate con tu asesor para renovar.' : 'Solo puedes consultar documentos. No puedes importar ni realizar cambios hasta renovar.' }
  const day = (date: Date) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
  const days = Math.round((Date.parse(day(end)) - Date.parse(day(now))) / 86400000)
  if (days < 0 || days > 10) return null
  return { variant: 'warning' as const, title: jarvis ? 'Tu certificado digital está por vencer' : 'Tu suscripción SIIGO está por vencer',
    message: `${jarvis ? 'El certificado digital' : 'Tu suscripción'} ${days === 0 ? 'vence hoy' : `vence en ${days} ${days === 1 ? 'día' : 'días'}`}. Comunícate con tu asesor para renovar.` }
}
