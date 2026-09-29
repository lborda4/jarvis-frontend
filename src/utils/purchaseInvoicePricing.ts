import type { ElectronicDocumentListItem } from '../types/electronicDocument'

/** Detectar únicamente cuando las líneas ORIGINALES concilian como precios
 * con IVA: importe pagable, base e impuesto deben coincidir. No usar la
 * proximidad a un subtotal (que puede excluir exentos), ni valores editados.
 * Sin evidencia suficiente se conservan los precios base del formulario. */
export function purchaseInvoicePricesIncludeIva(document: ElectronicDocumentListItem): boolean {
  if (!document.items?.length || !(document.documentIva > 0) ||
      (document.documentDiscount ?? 0) > 0 || (document.documentConsumptionTax ?? 0) > 0) return false

  let gross = 0
  let base = 0
  for (const item of document.items) {
    const rate = item.ivaPercentage ?? item.suggestedTax?.percentage ?? 0
    const amount = item.quantity * item.unitValue - (item.discount ?? 0)
    if (!Number.isFinite(amount) || amount < 0 || !Number.isFinite(rate) || rate < 0) return false
    gross += amount
    base += amount / (1 + rate / 100)
  }
  // Hasta un centavo por línea, con máximo de un peso por redondeos de origen.
  const tolerance = Math.min(1, Math.max(0.02, document.items.length * 0.01))
  return Math.abs(gross - document.total) <= tolerance &&
    Math.abs(base - document.documentSubtotal) <= tolerance &&
    Math.abs(gross - base - document.documentIva) <= tolerance
}


/** La conversión necesita evidencia monetaria del ítem original, nunca del IVA elegido. */
export function purchaseInvoiceItemIncludedIvaRate(document: ElectronicDocumentListItem, index: number): number {
  const item = document.items?.[index]
  if (!item || (document.documentConsumptionTax ?? 0) > 0) return 0
  const rate = item.ivaPercentage ?? item.suggestedTax?.percentage ?? 0
  if (!Number.isFinite(rate) || rate <= 0) return 0
  const gross = item.quantity * item.unitValue - (item.discount ?? 0)
  const factor = 1 + rate / 100
  if (item.total > 0 && Math.abs(gross / factor - item.total) <= 0.011 &&
      Math.abs(gross - item.total) > 0.02) return rate
  // Compatibilidad con documentos anteriores cuyo total de línea incluía IVA.
  return purchaseInvoicePricesIncludeIva(document) ? rate : 0
}
