import { useState, type MouseEvent } from 'react'
import { DownloadIcon } from '../icons/SidebarIcons'
import { getApiErrorMessage } from '../../services/apiClient'
import { downloadPurchaseInvoicePdf } from '../../utils/purchaseInvoicePdf'

interface PurchaseInvoiceDownloadButtonProps {
  documentId: string
  cufe: string | null | undefined
}

export default function PurchaseInvoiceDownloadButton({
  documentId,
  cufe,
}: PurchaseInvoiceDownloadButtonProps) {
  const [isDownloading, setIsDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!cufe?.trim()) {
    return null
  }

  async function handleDownload(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation()
    event.preventDefault()
    setError(null)
    setIsDownloading(true)

    try {
      await downloadPurchaseInvoicePdf(documentId)
    } catch (downloadError) {
      setError(
        getApiErrorMessage(
          downloadError,
          'No se pudo generar el PDF de la factura.',
        ),
      )
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <button
      type="button"
      className="support-table__download-button"
      onClick={(event) => void handleDownload(event)}
      disabled={isDownloading}
      aria-label={isDownloading ? 'Generando PDF' : 'Descargar factura en PDF'}
      title={error ?? (isDownloading ? 'Generando PDF…' : 'Descargar PDF')}
    >
      {isDownloading ? (
        <span className="support-table__action-spinner" aria-hidden="true" />
      ) : (
        <DownloadIcon />
      )}
    </button>
  )
}
