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
