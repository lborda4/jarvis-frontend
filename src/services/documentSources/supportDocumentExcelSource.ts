import type { ImportSupportDocumentsResponse } from '../../types/supportDocument'
import { adaptSupportDocumentsImportResponse } from '../../utils/normalizeSupportDocumentsResponse'
import { DOCUMENT_SOURCE_TYPE } from '../../types/documentSource'
import type { DocumentSourceAdapter } from './types'
import { uploadMultipartFile } from './uploadMultipartFile'

export const supportDocumentExcelSource: DocumentSourceAdapter = {
  type: DOCUMENT_SOURCE_TYPE.EXCEL,
  label: 'Excel Documento soporte',
  uploadEndpoint: '/invoices/support-documents/import',
  upload: async (file, _options) => {
    const response = await uploadMultipartFile<ImportSupportDocumentsResponse>(
      '/invoices/support-documents/import',
      file,
    )

    const adapted = adaptSupportDocumentsImportResponse(response)

    if (!adapted) {
      throw new Error(
        'No se pudo procesar la respuesta del archivo Excel de Documento soporte.',
      )
    }

    return {
      tableData: adapted,
      rawResponse: response,
    }
  },
}
