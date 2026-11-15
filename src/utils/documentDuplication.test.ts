import { describe, expect, it } from 'vitest'
import { duplicateInvoicePrefill } from './documentDuplication'
import type { JarvisInvoiceDetail } from '../services/jarvisService'

const invoice: JarvisInvoiceDetail = {
  id: 'original', providerId: '1', number: '21', prefix: 'FE', issueDate: '2026-10-06',
  customerName: 'Cliente', customerIdentification: '123', currency: 'COP', total: '214.20',
  cufe: 'original-cufe', status: 'SENT', sentAt: '2026-10-06',
  sourceRequest: {
    number: 21, prefix: 'FE', issueDate: '2026-10-06', customerDocumentType: 'NIT', customerIdentification: '123',
    observations: 'Servicio mensual', headNote: 'Encabezado', footNote: 'Pie', sellerIds: ['seller'],
    attachmentDraftId: 'old-draft', billingReference: { number: 'FE1', uuid: 'old', issueDate: '2026-01-01' },
    items: [{ code: 'ABC', description: 'Servicio', quantity: 2, unitValue: 100, discount: 20, taxAmount: 34.2, taxId: 1, notes: 'Detalle', retention: { id: 6, type: 'ReteRenta', percentage: 2.5 } }],
    retentions: [{ id: 7, type: 'ReteICA', percentage: 4.14 }],
    payment: { id: 10, payment_form_id: 2, due_date: '2026-11-05' },
    paymentBreakdown: [
      { methodId: 'cash', methodName: 'Efectivo', nextpymeMethodId: 1, negotiation: 'CASH', amount: 100 },
      { methodId: 'credit', methodName: 'Crédito', nextpymeMethodId: 10, negotiation: 'CREDIT', amount: 114.2 },
    ],
  },
}

describe('duplicar factura o documento soporte', () => {
  it('conserva los datos y el plazo sin reutilizar consecutivos, referencias ni adjuntos del original', () => {
    const original = structuredClone(invoice)
    const copy = duplicateInvoicePrefill(invoice, [], '2026-11-06')
    expect(copy.request).toMatchObject({ issueDate: '2026-11-06', observations: 'Servicio mensual', headNote: 'Encabezado', footNote: 'Pie', sellerIds: ['seller'], payment: { due_date: '2026-12-06' } })
    expect(copy.request.items).toEqual(invoice.sourceRequest!.items)
    expect(copy.request.paymentBreakdown).toEqual(invoice.sourceRequest!.paymentBreakdown)
    expect(copy.lines[0]).toMatchObject({ quantity: '2', unitValue: '100', discount: '20', taxPercent: '19', notes: 'Detalle' })
    expect(copy.taxes.find(tax => tax.id === copy.reteIcaId)?.percentage).toBe(4.14)
    expect(copy.request).not.toHaveProperty('number')
    expect(copy.request).not.toHaveProperty('prefix')
    expect(copy.request).not.toHaveProperty('billingReference')
    expect(copy.request).not.toHaveProperty('attachmentDraftId')
    expect(copy).not.toHaveProperty('billingUuid')
    copy.request.items[0].description = 'Modificado'
    expect(invoice).toEqual(original)
  })
  it('actualiza también el vencimiento de contado y rechaza documentos sin detalle', () => {
    const cash = { ...invoice, sourceRequest: { ...invoice.sourceRequest!, payment: { id: 1, payment_form_id: 1, due_date: invoice.issueDate } } }
    expect(duplicateInvoicePrefill(cash, [], '2026-11-06').request.payment?.due_date).toBe('2026-11-06')
    expect(() => duplicateInvoicePrefill({ ...invoice, sourceRequest: null }, [], '2026-11-06')).toThrow('no tiene el detalle')
  })
})

