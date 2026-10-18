import type { JarvisPaymentMethod } from '../services/jarvisPaymentMethodService'
import type { PaymentEntry } from './paymentBalance'

// The master payment method describes the payment instrument, not its terms:
// Crédito clientes maps to Otro, whereas Tarjeta crédito is an immediate payment.
export function isCreditPaymentMethod(method: JarvisPaymentMethod): boolean {
  if (method.negotiation) return method.negotiation === 'CREDIT'
  const name = method.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
  return /^credito\b/.test(name) || /\bcuentas? por (cobrar|pagar)\b/.test(name)
}

export function paymentMethodsForNegotiation(methods: JarvisPaymentMethod[], credit: boolean, mixed = false): JarvisPaymentMethod[] {
  return mixed ? methods : methods.filter(method => isCreditPaymentMethod(method) === credit)
}

export interface InvoicePaymentAllocation {
  methodId: string
  methodName: string
  nextpymeMethodId: number
  negotiation: 'CASH' | 'CREDIT'
  amount: number
}

export function buildPaymentBreakdown(entries: PaymentEntry[], methods: JarvisPaymentMethod[]): InvoicePaymentAllocation[] {
  return entries.filter(entry => Number(entry.amount) > 0).map(entry => {
    const method = methods.find(item => item.id === entry.methodId)
    if (!method) throw new Error('Selecciona una forma de pago para cada importe.')
    return { methodId: method.id, methodName: method.name, nextpymeMethodId: method.nextpymeMethodId,
      negotiation: isCreditPaymentMethod(method) ? 'CREDIT' : 'CASH', amount: Math.round(Number(entry.amount) * 100) / 100 }
  })
}

export function primaryPaymentForNegotiation(entries: PaymentEntry[], methods: JarvisPaymentMethod[], mixed: boolean): PaymentEntry | undefined {
  return mixed
    ? entries.find(entry => Number(entry.amount) > 0 && methods.some(method => method.id === entry.methodId && isCreditPaymentMethod(method)))
    : entries.find(entry => Number(entry.amount) > 0) ?? entries[0]
}

export function alignPaymentMethods(entries: PaymentEntry[], methods: JarvisPaymentMethod[]): PaymentEntry[] {
  return entries.map(entry => entry.methodId && !methods.some(method => method.id === entry.methodId)
    ? { ...entry, methodId: methods[0]?.id ?? '' }
    : entry)
}
