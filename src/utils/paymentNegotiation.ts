import type { JarvisPaymentMethod } from '../services/jarvisPaymentMethodService'
import type { PaymentEntry } from './paymentBalance'

// The master payment method describes the payment instrument, not its terms:
// Crédito clientes maps to Otro, whereas Tarjeta crédito is an immediate payment.
export function isCreditPaymentMethod(method: JarvisPaymentMethod): boolean {
  const name = method.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
  return /^credito\b/.test(name) || /\bcuentas? por (cobrar|pagar)\b/.test(name)
}

export function paymentMethodsForNegotiation(methods: JarvisPaymentMethod[], credit: boolean): JarvisPaymentMethod[] {
  return methods.filter(method => isCreditPaymentMethod(method) === credit)
}

export function alignPaymentMethods(entries: PaymentEntry[], methods: JarvisPaymentMethod[]): PaymentEntry[] {
  return entries.map(entry => entry.methodId && !methods.some(method => method.id === entry.methodId)
    ? { ...entry, methodId: methods[0]?.id ?? '' }
    : entry)
}
