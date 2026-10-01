import { describe, expect, it } from 'vitest'
import { creditNotePrefill } from './creditNotePrefill'
import type { JarvisInvoiceDetail } from '../services/jarvisService'

const invoice: JarvisInvoiceDetail = {
  id: 'invoice', providerId: '1', prefix: 'SETP', number: 'SETP123', issueDate: '2026-09-29',
  customerName: 'Cliente', customerIdentification: '123', currency: 'COP', total: '214.20',
  cufe: 'a'.repeat(96), status: 'SENT', sentAt: '2026-09-29',
  sourceRequest: { issueDate: '2026-09-29', customerDocumentType: 'NIT', customerIdentification: '123',
    items: [{ code: 'ABC', description: 'Producto', quantity: 2, unitValue: 100, discount: 20, taxId: 1, taxAmount: 34.2,
      retention: { id: 6, type: 'ReteRenta', percentage: 2.5 } }, { description: 'Sin IVA', quantity: 1, unitValue: 50 }],
    retentions: [{ id: 7, type: 'ReteICA', percentage: 4.14 }], observations: 'Original',
  },
}
describe('creditNotePrefill', () => {
  it('copies the reference and line values without current product prices or taxes', () => {
    const result = creditNotePrefill(invoice, [])
    expect(result.billingNumber).toBe('SETP123')
    expect(result.billingUuid).toBe(invoice.cufe)
    expect(result.lines[0]).toMatchObject({ code: 'ABC', quantity: '2', unitValue: '100', discount: '20', taxPercent: '19' })
    expect(result.lines[1].taxChargeId).toBe('')
    expect(result.taxes.find(tax => tax.id === result.lines[0].taxRetentionId)?.percentage).toBe(2.5)
    expect(result.taxes.find(tax => tax.id === result.reteIcaId)?.percentage).toBe(4.14)
    expect(result.request?.observations).toBe('Original')
  })
  it('reuses a matching configured tax and does not mutate the catalog', () => {
    const taxes = [{ id: 'saved:1', name: 'IVA', type: 'IVA', percentage: 19, category: 'IMPUESTO' as const, catalogId: 1 }]
    expect(creditNotePrefill(invoice, taxes).lines[0].taxChargeId).toBe('saved:1')
    expect(taxes).toHaveLength(1)
  })
  it('keeps legacy references without fabricating line items', () => {
    const result = creditNotePrefill({ ...invoice, number: '123', sourceRequest: null }, [])
    expect(result.billingNumber).toBe('SETP123')
    expect(result.lines).toEqual([])
    expect(result.request).toBeNull()
  })
})
