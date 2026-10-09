import type { CreateJarvisInvoiceRequest, JarvisInvoiceDetail } from '../services/jarvisService'
import type { JarvisPaymentMethod } from '../services/jarvisPaymentMethodService'
import { isCreditPaymentMethod } from './paymentNegotiation'
import type { SalesInvoiceTaxOption } from './salesInvoiceTaxes'

export function resolveInvoicePaymentPrefill(
  payment: CreateJarvisInvoiceRequest['payment'] | undefined,
  methods: JarvisPaymentMethod[],
  forms: Array<{ id: number | string; name?: string }>,
) {
  if (!payment) return null
  const method = methods.find((item) => item.nextpymeMethodId === payment.id)
  let paymentFormId: string | undefined
  if (payment.payment_form_id != null) {
    const form = forms.find((item) => Number(item.id) === payment.payment_form_id)
    paymentFormId = form ? String(form.id) : String(payment.payment_form_id)
  } else if (method && forms.length) {
    const credit = isCreditPaymentMethod(method)
    const form = forms.find((item) => (item.name?.toLowerCase().includes('cr') ?? false) === credit)
    if (form) paymentFormId = String(form.id)
  }
  return { paymentFormId, methodId: method?.id, dueDate: payment.due_date }
}

export function creditNotePrefill(invoice: JarvisInvoiceDetail, catalog: SalesInvoiceTaxOption[]) {
  const request = invoice.sourceRequest
  const taxes = [...catalog]
  const taxOption = (catalogId: number, rate: number, category: 'IMPUESTO' | 'RETENCION', type: string) => {
    const match = taxes.find(tax => tax.catalogId === catalogId && tax.category === category && Math.abs((tax.percentage ?? 0) - rate) < .00001)
    if (match) return match.id
    const id = `invoice:${category}:${catalogId}:${rate}`
    taxes.push({ id, catalogId, name: `${type} de la factura`, type, percentage: rate, category })
    return id
  }
  const lines = (request?.items ?? []).map((item, index) => {
    const base = item.quantity * item.unitValue - (item.discount ?? 0)
    const rate = base > 0 ? (item.taxAmount ?? 0) * 100 / base : 0
    // Recover the original rate from the amount; do not inherit a product's current tax.
    const taxPercent = Math.round(rate * 1000000000000) / 1000000000000
    const taxChargeId = item.taxId != null || (item.taxAmount ?? 0) > 0
      ? taxOption(item.taxId ?? 1, taxPercent, 'IMPUESTO', (item.taxId ?? 1) === 1 ? 'IVA' : 'Impuesto') : ''
    const taxRetentionId = item.retention ? taxOption(item.retention.id, item.retention.percentage ?? 0, 'RETENCION', item.retention.type ?? 'Retención') : ''
    return { id: `${invoice.id}:${index}`, productSearch: item.code || item.description, code: item.code,
      description: item.description, notes: item.notes, quantity: String(item.quantity), unitValue: String(item.unitValue),
      discount: String(item.discount ?? 0), priceOptions: [], selectedPriceId: '', taxChargeId, taxRetentionId, taxPercent: String(taxPercent) }
  })
  const retention = request?.retentions?.[0]
  const reteIcaId = retention ? taxOption(retention.id, retention.percentage ?? 0, 'RETENCION', retention.type ?? 'ReteICA') : ''
  return {
    billingNumber: invoice.number.startsWith(invoice.prefix) ? invoice.number : `${invoice.prefix}${invoice.number}`,
    billingUuid: invoice.cufe ?? '', billingDate: invoice.issueDate, request, lines, taxes, reteIcaId,
  }
}
