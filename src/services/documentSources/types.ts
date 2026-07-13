import type { DocumentSourceType } from '../../types/documentSource'
import type {
  DocumentUploadOptions,
  DocumentUploadResult,
} from '../../types/documentUpload'

export interface DocumentSourceAdapter {
  type: DocumentSourceType
  label: string
  uploadEndpoint: string
  upload: (
    file: File,
    options: DocumentUploadOptions,
  ) => Promise<DocumentUploadResult>
}
