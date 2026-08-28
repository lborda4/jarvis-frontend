import type { PurchaseInvoiceImportStatus } from './supportDocument'

export interface PurchaseInvoiceImportProgressEvent {
  jobId: string
  processedRows: number
  totalRows: number | null
  successCount: number
  errorCount: number
  progressPercent: number | null
}

export interface PurchaseInvoiceImportRowResultEvent {
  jobId: string
  rowIndex: number
  cufe: string
  issuerNit: string
  issuerName: string
  status: 'success' | 'failed'
  errorMessage: string | null
  documentId: string | null
}

/** Estado de un job de importación tal como lo ve el frontend — arranca con
 * solo jobId/totalRows (lo único que sabemos apenas se encola) y se va
 * completando con los eventos de WebSocket / la respuesta REST de
 * hidratación, lo que llegue primero. */
export interface PurchaseInvoiceImportJobState {
  jobId: string
  status: PurchaseInvoiceImportStatus['status']
  processedRows: number
  totalRows: number | null
  successCount: number
  errorCount: number
  progressPercent: number | null
  errorMessage: string | null
  rowResultsByIndex: Record<number, PurchaseInvoiceImportRowResultEvent>
  finalStatus: PurchaseInvoiceImportStatus | null
}
