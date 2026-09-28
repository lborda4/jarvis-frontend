import { triggerBrowserDownload } from '../utils/downloadFile'
import { apiClient } from './apiClient'

const SUPPORT_DOCUMENT_TEMPLATE_ENDPOINT =
  '/invoices/support-documents/template'

const SUPPORT_DOCUMENT_TEMPLATE_FILENAME =
  'plantilla-documento-soporte.xlsx'

export async function downloadSupportDocumentTemplate(
  provider?: 'SIIGO' | 'JARVIS',
): Promise<void> {
  const response = await apiClient.get<Blob>(
    SUPPORT_DOCUMENT_TEMPLATE_ENDPOINT,
    {
      responseType: 'blob',
      params: provider ? { provider } : undefined,
    },
  )

  triggerBrowserDownload(
    response.data,
    SUPPORT_DOCUMENT_TEMPLATE_FILENAME,
  )
}
