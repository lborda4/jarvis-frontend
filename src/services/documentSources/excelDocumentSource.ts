import { DOCUMENT_SOURCE_TYPE } from '../../types/documentSource'
import type { ExtractInvoicesResponse } from '../../types/invoice'
import { adaptToExtractInvoicesResponse } from '../../utils/normalizeInvoicesResponse'
import type { DocumentSourceAdapter } from './types'
import { uploadDocumentFile } from './uploadDocumentFile'

export const excelDocumentSource: DocumentSourceAdapter = {
  type: DOCUMENT_SOURCE_TYPE.EXCEL,
  label: 'Excel DIAN',
  uploadEndpoint: '/invoices',
  upload: async (file, options) => {
    const response = await uploadDocumentFile<ExtractInvoicesResponse>(
      '/invoices',
      file,
      options,
    )

    const adapted = adaptToExtractInvoicesResponse(response)

    if (!adapted) {
      throw new Error('No se pudo procesar la respuesta del archivo Excel.')
    }

    return {
      tableData: adapted,
      rawResponse: response,
    }
  },
}
