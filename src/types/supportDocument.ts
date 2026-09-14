import type { ExtractInvoicesResponse, InvoicePreview } from './invoice'

export interface ImportSupportDocumentsResponse {
  processedRows: number
  documentsCreated: number
  itemsTotal: number
  documentIds: string[]
  total: number
  filters: ExtractInvoicesResponse['filters']
  records: InvoicePreview[]
}

export interface ImportFailedRow {
  cufe: string
  issuerNit: string
  issuerName: string
  error: string
}

/** Respuesta al arrancar la importación de Factura de compra por Excel: solo
 * confirma que el job quedó encolado — el procesamiento real (consultas a
 * NextPyme por CUFE, creación de documentos) corre en segundo plano porque
 * con 500+ filas supera cualquier timeout de request HTTP. Consultar
 * progreso/resultado con PurchaseInvoiceImportStatus. */
export interface StartPurchaseInvoiceImportResponse {
  jobId: string
  totalRows: number
}

export interface PurchaseInvoiceValidationRowError {
  rowIndex: number
  cufe: string
  issuerNit: string
  issuerName: string
  reason: string
}

/** Reporte de la pasada de validación rápida (campos faltantes, CUFEs
 * duplicados, formato de NIT) que corre ANTES de tocar NextPyme/SIIGO. */
export interface PurchaseInvoiceValidationReport {
  totalRows: number
  validRows: number
  invalidRows: number
  errors: PurchaseInvoiceValidationRowError[]
}

export interface SupportDocumentValidationRowError {
  groupKey: string
  /** "Prefijo+Consecutivo (NIT proveedor)" — lo que el usuario puede buscar
   * en el Excel para encontrar el documento con el error. */
  reference: string
  reason: string
}

/** Reporte de la pasada de validación rápida (tipo de documento inválido,
 * centro de costos que no existe en SIIGO) que corre ANTES de confirmar la
 * importación de Documento Soporte. */
export interface SupportDocumentValidationReport {
  totalGroups: number
  validGroups: number
  invalidGroups: number
  errors: SupportDocumentValidationRowError[]
}

export interface PurchaseInvoiceImportFailedRowDetail {
  rowIndex: number
  cufe: string
  issuerNit: string
  issuerName: string
  errorMessage: string
}

export interface PurchaseInvoiceImportStatus {
  jobId: string | null
  status: 'pending' | 'running' | 'completed' | 'error' | null
  processedRows: number
  totalRows: number | null
  successCount: number
  errorCount: number
  /** 0-100, null si totalRows todavía no se conoce. */
  progressPercent: number | null
  itemsTotal: number | null
  documentsCreated: number | null
  documentIds: string[] | null
  records: InvoicePreview[] | null
  /** Detalle de filas fallidas (hasta 200) — se llena incrementalmente por lote, no solo al terminar. */
  failedRows: PurchaseInvoiceImportFailedRowDetail[]
  /** Presente solo si el job terminó en error porque la validación previa encontró filas inválidas. */
  validation: PurchaseInvoiceValidationReport | null
  errorMessage: string | null
  startedAt: string | null
  completedAt: string | null
}
