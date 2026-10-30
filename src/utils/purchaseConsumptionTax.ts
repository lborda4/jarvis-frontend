import type { SiigoTaxOption } from '../constants/siigoTaxCatalog'
import type { ElectronicDocumentListItem } from '../types/electronicDocument'

export function isSiigoConsumptionTaxType(type: string): boolean {
  return ['impoconsumo', 'impuesto al consumo', 'inc'].includes(type.trim().toLowerCase())
}

export function purchaseItemConsumptionRate(document: ElectronicDocumentListItem, index: number): number {
  const item = document.items?.[index]
  const explicit = item?.consumptionTaxPercentage ?? item?.suggestedConsumptionTax?.percentage
  if (explicit != null) return explicit
  if (document.items?.some(line => line.consumptionTaxPercentage != null)) return 0
  return (document.documentConsumptionTax ?? 0) > 0 && document.documentSubtotal > 0
    ? (document.documentConsumptionTax! / document.documentSubtotal) * 100 : 0
}

export function resolvePurchaseItemConsumptionTax(document: ElectronicDocumentListItem, index: number): SiigoTaxOption | null {
  const tax = document.items?.[index]?.suggestedConsumptionTax
  const rate = purchaseItemConsumptionRate(document, index)
  return tax && tax.id > 0 && rate > 0 && Math.abs(tax.percentage - rate) < 0.01
    ? { ...tax, type: 'Impoconsumo' } : null
}
