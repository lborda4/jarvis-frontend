import type { ElectronicDocumentType } from './electronicDocument'
import type { ExtractInvoicesResponse } from './invoice'

export interface DocumentUploadOptions {
  provider?: 'SIIGO' | 'JARVIS'
  electronicDocumentType: ElectronicDocumentType
}

export interface DocumentUploadResult {
  tableData: ExtractInvoicesResponse
  rawResponse: unknown
}
