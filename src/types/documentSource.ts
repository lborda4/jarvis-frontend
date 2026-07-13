export const DOCUMENT_SOURCE_TYPE = {
  EXCEL: 'excel',
  XML: 'xml',
} as const

export type DocumentSourceType =
  (typeof DOCUMENT_SOURCE_TYPE)[keyof typeof DOCUMENT_SOURCE_TYPE]

export interface LoadedDocumentInfo {
  fileName: string
  sourceType: DocumentSourceType
  sourceLabel: string
}
