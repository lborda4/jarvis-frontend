import { DOCUMENT_SOURCE_TYPE } from '../../types/documentSource'
import type { ParseXmlResponse } from '../../types/xmlInvoice'
import { adaptToExtractInvoicesResponse } from '../../utils/normalizeInvoicesResponse'
import type { DocumentSourceAdapter } from './types'
import { uploadDocumentFile } from './uploadDocumentFile'

export const xmlDocumentSource: DocumentSourceAdapter = {
  type: DOCUMENT_SOURCE_TYPE.XML,
  label: 'XML factura electrónica',
  uploadEndpoint: '/invoices/xml',
  upload: async (file, options) => {
    const response = await uploadDocumentFile<ParseXmlResponse>(
      '/invoices/xml',
      file,
      options,
    )

    const adapted = adaptToExtractInvoicesResponse(response)

    if (!adapted) {
      throw new Error('No se pudo procesar la respuesta del archivo XML.')
    }

    return {
      tableData: adapted,
      rawResponse: response,
    }
  },
}
