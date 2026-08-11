import type { ImportSupportDocumentsResponse } from '../../types/supportDocument'
import { adaptSupportDocumentsImportResponse } from '../../utils/normalizeSupportDocumentsResponse'
import { DOCUMENT_SOURCE_TYPE } from '../../types/documentSource'
import type { DocumentSourceAdapter } from './types'
import { uploadMultipartFile } from './uploadMultipartFile'

export const purchaseInvoiceExcelSource: DocumentSourceAdapter = {
  type: DOCUMENT_SOURCE_TYPE.EXCEL,
  label: 'Excel Factura de compra DIAN',
  uploadEndpoint: '/invoices/purchase-invoices/import',
  upload: async (file, _options) => {
    const response = await uploadMultipartFile<ImportSupportDocumentsResponse>(
      '/invoices/purchase-invoices/import',
      file,
    )

    const adapted = adaptSupportDocumentsImportResponse(response)

    if (!adapted) {
      throw new Error(
        'No se pudo procesar la respuesta del Excel de Factura de compra.',
      )
    }

    return {
      tableData: adapted,
      rawResponse: response,
    }
  },
}
