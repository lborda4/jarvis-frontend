import type { ElectronicDocumentType } from './electronicDocument'
import type { ExtractInvoicesResponse } from './invoice'

export interface DocumentUploadOptions {
  electronicDocumentType: ElectronicDocumentType
}

export interface DocumentUploadResult {
  tableData: ExtractInvoicesResponse
  rawResponse: unknown
}
