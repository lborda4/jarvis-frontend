import type { InvoicePreview } from './invoice'

export const IMPORT_ROW_STATUS = {
  PENDIENTE: 'PENDIENTE',
  EN_PROCESO: 'EN PROCESO',
  REQUIERE_PROVEEDOR: 'REQUIERE PROVEEDOR',
  REQUIERE_CUENTA: 'REQUIERE CUENTA',
  /** Factura de compra: al menos un ítem tipo Producto quedó sin código —
   * ni la regla exacta del proveedor ni la IA encontraron uno en el
   * catálogo real (ej. primera compra de un producto nuevo). Vuelve a
   * PENDIENTE solo cuando se recalcula sin ítems sin resolver (ver
   * hasUnresolvedProductItem) — no es un estado que se "marque" manualmente,
   * se deriva de los datos igual que el resto de IMPORT_ROW_STATUS. */
  REQUIERE_REVISION: 'REQUIERE REVISIÓN',
  LISTA: 'LISTA',
  ERROR: 'ERROR',
} as const

export type ImportRowStatus =
  (typeof IMPORT_ROW_STATUS)[keyof typeof IMPORT_ROW_STATUS]

export interface InvoiceTableRow extends InvoicePreview {
  importStatus: ImportRowStatus
}

export function createInvoiceTableRows(
  records: Partial<InvoicePreview>[] | null | undefined,
): InvoiceTableRow[] {
  if (!Array.isArray(records)) return []

  return records.map((record, index) => ({
    cufe: record?.cufe?.trim() || `record-${index}`,
    documentType: record?.documentType ?? '',
    folio: record?.folio ?? '',
    prefix: record?.prefix ?? '',
    issueDate: record?.issueDate ?? '',
    receptionDate: record?.receptionDate ?? '',
    issuerNit: record?.issuerNit ?? '',
    issuerName: record?.issuerName ?? '',
    receiverNit: record?.receiverNit ?? '',
    receiverName: record?.receiverName ?? '',
    currency: record?.currency ?? 'COP',
    paymentMethod: record?.paymentMethod ?? '',
    total: Number.isFinite(Number(record?.total)) ? Number(record?.total) : 0,
    status: record?.status ?? '',
    group: record?.group ?? '',
    importStatus: IMPORT_ROW_STATUS.PENDIENTE,
  }))
}
