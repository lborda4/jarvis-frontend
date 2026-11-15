import type { JarvisInvoiceDetail } from '../services/jarvisService'
import { creditNotePrefill } from './creditNotePrefill'
import type { SalesInvoiceTaxOption } from './salesInvoiceTaxes'
import { addDaysToLocalDate, daysBetweenLocalDates } from './supportDocumentDate'

export function duplicateInvoicePrefill(invoice: JarvisInvoiceDetail, taxes: SalesInvoiceTaxOption[], today: string) {
  if (!invoice.sourceRequest?.items.length)
    throw new Error('Este documento antiguo no tiene el detalle guardado y no se puede duplicar.')
  const original = invoice.sourceRequest
  // Copy business data only. Numbering, references and authorization belong to the new document.
  const request = {
    issueDate: today,
    customerDocumentType: original.customerDocumentType,
    customerIdentification: original.customerIdentification,
    customerName: original.customerName,
    currency: original.currency,
    observations: original.observations,
    headNote: original.headNote,
    footNote: original.footNote,
    items: structuredClone(original.items),
    retentions: structuredClone(original.retentions),
    sellerIds: original.sellerIds?.slice(),
    paymentBreakdown: structuredClone(original.paymentBreakdown),
    payment: original.payment ? {
      ...original.payment,
      due_date: addDaysToLocalDate(today, Math.max(0, daysBetweenLocalDates(original.issueDate, original.payment.due_date ?? original.issueDate))),
    } : undefined,
  }
  const prefill = creditNotePrefill({ ...invoice, sourceRequest: request }, taxes)
  return { request, lines: prefill.lines, taxes: prefill.taxes, reteIcaId: prefill.reteIcaId, reteIvaId: prefill.reteIvaId }
}

