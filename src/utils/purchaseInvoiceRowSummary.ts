import type { SiigoTaxOption } from '../constants/siigoTaxCatalog'
import type { ElectronicDocumentListItem } from '../types/electronicDocument'
import type { PurchaseInvoiceItemDraft } from '../types/purchaseInvoiceItemDraft'
import { purchaseInvoiceItemDraftRetefuenteAmount } from '../types/purchaseInvoiceItemDraft'
import {
  calculateRetentionAmount,
  resolveRetentionBase,
  roundMoney,
} from './siigoSupportDocumentTotal'

export interface PurchaseInvoiceRetentionLine {
  type: string
  label: string
  amount: number
}

export interface PurchaseInvoiceRowSummary {
  subtotal: number
  ivaAmount: number
  consumptionTaxAmount: number
  retentionLines: PurchaseInvoiceRetentionLine[]
  /** Descuento general del documento (DIAN allowance_total_amount). Ya viene
   * reflejado en `document.total` (payable_amount), solo se muestra como
   * dato informativo — no se resta de nuevo al armar `total`. */
  documentDiscount: number
  total: number
}

const RETENTION_TYPE_ABBREVIATIONS: Record<string, string> = {
  Retefuente: 'Rte.Fte',
  ReteICA: 'Rte.ICA',
  ReteIVA: 'Rte.IVA',
  ReteRenta: 'Rte.Renta',
}

function formatRetentionAbbreviation(type: string): string {
  return RETENTION_TYPE_ABBREVIATIONS[type] ?? type
}

/** Subtotal e IVA vienen certificados por la DIAN en el JSON de origen
 * (legal_monetary_totals.tax_exclusive_amount y la suma de tax_totals de
 * factura) — nunca se recalculan desde cantidad × valor unitario ni desde el
 * % de IVA elegido por ítem, porque en algunos proveedores el valor unitario
 * ya incluye IVA (duplicaría el impuesto) o el subtotal ya viene neto. */
function calculateSubtotalAndIva(
  document: ElectronicDocumentListItem,
): { subtotal: number; ivaAmount: number } {
  return {
    subtotal: roundMoney(document.documentSubtotal),
    ivaAmount: roundMoney(document.documentIva),
  }
}

/** Retefuente ahora se elige por ítem (no a nivel de documento) — se suma lo
 * de cada línea en una sola línea agregada "Rte.Fte" para el resumen. */
function calculateRetefuenteLine(
  editedItems?: PurchaseInvoiceItemDraft[] | null,
): PurchaseInvoiceRetentionLine | null {
  if (!editedItems || editedItems.length === 0) {
    return null
  }

  const amount = roundMoney(
    editedItems.reduce(
      (sum, item) => sum + purchaseInvoiceItemDraftRetefuenteAmount(item),
      0,
    ),
  )

  if (amount <= 0) {
    return null
  }

  return { type: 'Retefuente', label: 'Rte.Fte', amount }
}

/** Resumen monetario por fila (Subtotal/IVA/Retenciones/Total) de la columna
 * de Factura de compra. Subtotal/IVA son siempre los certificados por la
 * DIAN (nunca se recalculan); las retenciones sí dependen de `editedItems`
 * (elegidas por el contador en el panel de detalle), calculadas con el mismo
 * criterio (base, ReteICA en ‰, ReteIVA sobre el IVA) que usa el armado del
 * payload de envío a SIIGO, y la Retefuente elegida por ítem se agrega como
 * una línea más de retención. */
export function calculatePurchaseInvoiceRowSummary(
  document: ElectronicDocumentListItem,
  retentions: SiigoTaxOption[],
  editedItems?: PurchaseInvoiceItemDraft[] | null,
  /** Compatibilidad con borradores anteriores; prevalece el descuento original. */
  _documentDiscountOverride?: number | null,
): PurchaseInvoiceRowSummary {
  const { subtotal, ivaAmount } = calculateSubtotalAndIva(document)

  const retentionLines = retentions
    .filter((tax) => Number.isFinite(tax.percentage) && tax.percentage > 0)
    .map((tax) => {
      const base = resolveRetentionBase(tax.type, subtotal, ivaAmount)

      return {
        type: tax.type,
        label: `${formatRetentionAbbreviation(tax.type)} ${tax.percentage}%`,
        amount: calculateRetentionAmount(tax.type, tax.percentage, base),
      }
    })

  const retefuenteLine = calculateRetefuenteLine(editedItems)
  if (retefuenteLine) {
    retentionLines.push(retefuenteLine)
  }

  const retentionTotal = roundMoney(
    retentionLines.reduce((sum, line) => sum + line.amount, 0),
  )
  const documentDiscount = document.documentDiscount ?? 0

  return {
    subtotal,
    ivaAmount,
    consumptionTaxAmount: roundMoney(document.documentConsumptionTax ?? 0),
    retentionLines,
    documentDiscount,
    total: roundMoney(document.total - retentionTotal),
  }
}
