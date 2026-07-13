import { apiClient } from './apiClient'

const SUPPORT_DOCUMENT_TEMPLATE_ENDPOINT =
  '/invoices/support-documents/template'

const SUPPORT_DOCUMENT_TEMPLATE_FILENAME =
  'plantilla-documento-soporte.xlsx'

function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

export async function downloadSupportDocumentTemplate(): Promise<void> {
  const response = await apiClient.get<Blob>(
    SUPPORT_DOCUMENT_TEMPLATE_ENDPOINT,
    {
      responseType: 'blob',
    },
  )

  triggerBrowserDownload(
    response.data,
    SUPPORT_DOCUMENT_TEMPLATE_FILENAME,
  )
}
