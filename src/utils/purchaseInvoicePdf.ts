import { pdf } from '@react-pdf/renderer'
import QRCode from 'qrcode'
import { renderPurchaseInvoicePdfDocument } from '../components/invoice/PurchaseInvoicePdfDocument'
import { fetchPurchaseInvoiceDownload } from '../services/electronicDocumentService'
import type { PurchaseInvoiceDownload } from '../types/electronicDocument'
import { buildPurchaseInvoicePdfFilename } from './dianInvoiceQr'
import { triggerBrowserDownload } from './downloadFile'

export async function generatePurchaseInvoicePdfBlob(
  data: PurchaseInvoiceDownload,
): Promise<Blob> {
  const qrDataUrl = await QRCode.toDataURL(data.dianQrText, {
    margin: 1,
    width: 180,
    errorCorrectionLevel: 'M',
  })

  return pdf(renderPurchaseInvoicePdfDocument(data, qrDataUrl)).toBlob()
}

export async function downloadPurchaseInvoicePdf(
  documentId: string,
): Promise<void> {
  const data = await fetchPurchaseInvoiceDownload(documentId)
  const blob = await generatePurchaseInvoicePdfBlob(data)
  triggerBrowserDownload(
    blob,
    buildPurchaseInvoicePdfFilename(data.invoiceNumber, data.cufe),
  )
}
