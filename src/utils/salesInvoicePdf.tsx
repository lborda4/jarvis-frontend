import { pdf } from '@react-pdf/renderer'
import QRCode from 'qrcode'
import { SalesInvoicePdfDocument } from '../components/invoice/SalesInvoicePdfDocument'
import type { PurchaseInvoiceDownload } from '../types/electronicDocument'

export async function generateSalesInvoicePdf(data: PurchaseInvoiceDownload): Promise<Blob> {
  const qr = await QRCode.toDataURL(data.dianQrText, { margin: 1, width: 240, errorCorrectionLevel: 'M' })
  return pdf(<SalesInvoicePdfDocument data={data} qr={qr} />).toBlob()
}
