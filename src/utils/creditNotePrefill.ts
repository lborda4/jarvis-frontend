import type { JarvisInvoiceDetail } from '../services/jarvisService'
import type { SalesInvoiceTaxOption } from './salesInvoiceTaxes'

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
