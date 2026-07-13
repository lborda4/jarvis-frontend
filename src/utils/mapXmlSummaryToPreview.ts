import type { InvoicePreview } from '../types/invoice'
import type { XmlImportSummary } from '../types/xmlInvoice'

export function mapXmlSummaryToInvoicePreview(
  summary: XmlImportSummary,
  documentId: string,
): Partial<InvoicePreview> {
  return {
    cufe: documentId,
    documentType: 'Factura electrónica',
    folio: summary.invoiceNumber,
    prefix: '',
    issueDate: summary.invoiceDate,
    receptionDate: '',
    issuerNit: summary.supplierDocument,
    issuerName: summary.supplierName,
    receiverNit: '',
    receiverName: '',
    currency: 'COP',
    paymentMethod: '',
    total: summary.total,
    status: '',
    group: '',
  }
}
