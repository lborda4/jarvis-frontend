import type { DocumentSourceType } from '../../types/documentSource'
import { ELECTRONIC_DOCUMENT_TYPE } from '../../types/electronicDocument'
import type {
  DocumentUploadOptions,
  DocumentUploadResult,
} from '../../types/documentUpload'
import { DOCUMENT_SOURCE_TYPE } from '../../types/documentSource'
import { excelDocumentSource } from './excelDocumentSource'
import { supportDocumentExcelSource } from './supportDocumentExcelSource'
import type { DocumentSourceAdapter } from './types'
import { xmlDocumentSource } from './xmlDocumentSource'

const documentSources: Record<DocumentSourceType, DocumentSourceAdapter> = {
  excel: excelDocumentSource,
  xml: xmlDocumentSource,
}

export function getDocumentSource(
  sourceType: DocumentSourceType,
): DocumentSourceAdapter {
  return documentSources[sourceType]
}

export function uploadDocument(
  sourceType: DocumentSourceType,
  file: File,
  options: DocumentUploadOptions,
): Promise<DocumentUploadResult> {
  if (
    options.electronicDocumentType ===
      ELECTRONIC_DOCUMENT_TYPE.SUPPORT_DOCUMENT &&
    sourceType === DOCUMENT_SOURCE_TYPE.EXCEL
  ) {
    return supportDocumentExcelSource.upload(file, options)
  }

  return getDocumentSource(sourceType).upload(file, options)
}

export { excelDocumentSource, supportDocumentExcelSource, xmlDocumentSource }
export type { DocumentSourceAdapter }
