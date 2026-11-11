import { describe, expect, it } from 'vitest'
import { invoiceDraftPdfData } from './invoiceDraftPdf'
import type { InvoiceDraftLine } from '../types/invoiceDraft'

const company = { id: 'company', name: 'Mi empresa', nit: '900123456-1' }
const base = { id: 'draft', kind: 'ELECTRONIC_INVOICE' as const, company, settings: {} }
const line: InvoiceDraftLine = { id: 'line', productSearch: 'P1 — Servicio', code: 'P1', description: 'Descripción original', quantity: '2', unitValue: '100',
  discount: '10', taxChargeId: 'default:iva19', taxRetentionId: '', taxPercent: '19', priceOptions: [], selectedPriceId: '' }

describe('vista previa de documentos guardados', () => {
  it('admite un borrador vacío sin cliente, fecha, productos ni pagos', () => {
    const result = invoiceDraftPdfData({ ...base, state: {} })
    expect(result).toMatchObject({ isDraft: true, cufe: '', dianQrText: '', invoiceNumber: 'Sin número', items: [], total: 0, issueDate: null })
    expect(result.issuer.name).toBe('Mi empresa')
    expect(result.buyer.name).toBeNull()
  })

  it('incluye datos parciales, notas y la configuración actual sin asignar un consecutivo', () => {
    const result = invoiceDraftPdfData({ ...base, settings: { business_name: 'Empresa configurada', vat_regime: 'non_vat_responsible', economic_activity: '4923',
      electronicInvoiceResolution: { kind: 'ELECTRONIC_INVOICE', documentTypeLabel: 'Factura', prefix: 'FE', fromNumber: 21, toNumber: 100, nextConsecutive: 25 } },
    state: { customerQuery: 'Cliente por completar', notes: 'Nota', headNote: 'Encabezado', footNote: 'Pie', lines: [{ ...line, description: '', notes: 'Detalle de la línea' }] } })
    expect(result.buyer.name).toBe('Cliente por completar')
    expect(result.observations).toBe('Encabezado\nNota\nPie')
    expect(result.items[0]).toMatchObject({ name: 'Servicio', description: 'Detalle de la línea' })
    expect(result.issuerTaxProfile).toMatchObject({ vatRegime: 'non_vat_responsible', economicActivity: '4923', source: 'current' })
    expect(result.invoiceNumber).toBe('Sin número')
    expect(result.authorization?.from).toBe('21')
  })

  it('calcula IVA, descuentos y retenciones con las mismas bases del formulario', () => {
    const result = invoiceDraftPdfData({ ...base, state: { lines: [{ ...line, taxRetentionId: 'default:reterenta2.5' }], discountIsPercent: true,
      reteIcaId: 'default:reteica4.14', reteIvaId: 'default:reteiva15' } })
    expect(result).toMatchObject({ subtotal: 180, iva: 34.2, taxInclusiveAmount: 214.2, total: 203.82 })
    expect(result.withholdings).toEqual([
      expect.objectContaining({ dianTaxCode: '06', amount: 4.5 }),
      expect.objectContaining({ dianTaxCode: '07', amount: 0.75 }),
      expect.objectContaining({ dianTaxCode: '05', amount: 5.13 }),
    ])
  })

  it('no aplica IVA por defecto a líneas que aún no tienen un impuesto seleccionado', () => {
    const result = invoiceDraftPdfData({ ...base, state: { lines: [{ ...line, discount: '0', taxChargeId: '' }] } })
    expect(result).toMatchObject({ iva: 0, total: 200, taxes: [] })
    expect(result.items[0].ivaPercentage).toBe(0)
  })

  it('separa impoconsumo de IVA y permite pagos por completar', () => {
    const result = invoiceDraftPdfData({ ...base, state: { paymentFormId: '2', lines: [{ ...line, discount: '0', taxChargeId: 'default:inc8', taxPercent: '8' }] } })
    expect(result).toMatchObject({ iva: 0, total: 216, taxes: [{ type: 'INC', amount: 16 }], isCreditPayment: true })
    expect(result.paymentBreakdown?.[0]).toMatchObject({ methodName: 'Sin seleccionar', negotiation: 'CREDIT', amount: 216 })
  })

  it('aplica el descuento general de una nota débito y conserva su referencia', () => {
    const result = invoiceDraftPdfData({ ...base, kind: 'DEBIT_NOTE', state: { lines: [{ ...line, discount: '0' }], generalDiscount: '8', billingNumber: 'FE3', billingDate: '2026-10-01' } })
    expect(result).toMatchObject({ subtotal: 200, iva: 38, taxExclusiveAmount: 192, total: 230, references: [{ type: 'Factura relacionada', number: 'FE3', date: '2026-10-01' }] })
  })
})
