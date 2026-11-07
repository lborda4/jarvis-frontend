import { describe, expect, it } from 'vitest'
import { isValidElement, type ReactNode } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import QRCode from 'qrcode'
import { SalesInvoicePdfDocument } from './SalesInvoicePdfDocument'
import type { PurchaseInvoiceDownload } from '../../types/electronicDocument'

const party = { name: 'Empresa de prueba', documentType: 'NIT', documentNumber: '123456789', checkDigit: '1', address: 'Calle 1', phone: '1234567', email: 'ejemplo@example.com', cityName: 'Bogotá' }
const data: PurchaseInvoiceDownload = {
  id: 'test', cufe: 'a'.repeat(96), invoiceNumber: 'SETP123', prefix: 'SETP', issueDate: '2026-09-01', dueDate: '2026-10-01', isCreditPayment: true, currency: 'COP',
  observations: 'Observaciones originales con acentos', issuer: party, buyer: party,
  items: [{ description: 'Servicio con descripción larga para comprobar el ajuste del texto en la tabla', code: 'ABC', quantity: 2, unitValue: 100, discount: 20, ivaPercentage: 19, ivaAmount: 34.2, total: 180, taxes: [{ type: 'IVA', amount: 34.2 }] }],
  subtotal: 180, taxExclusiveAmount: 180, taxInclusiveAmount: 214.2, iva: 34.2, discount: 0, total: 214.2, withholdings: [], dianQrText: 'https://example.com/invoice/test', dianQrUrl: '',
}
describe('sales invoice HTML template adaptation', () => {
  function textContent(node: ReactNode): string {
    if (typeof node === 'string' || typeof node === 'number') return String(node)
    if (Array.isArray(node)) return node.map(textContent).join('')
    if (isValidElement<{ children?: ReactNode }>(node)) return textContent(node.props.children)
    return ''
  }

  it.each(['emission', 'current'] as const)('muestra régimen IVA y CIIU con origen %s sin ocultar el tributo del XML', source => {
    const text = textContent(SalesInvoicePdfDocument({ data: {
      ...data, issuer: { ...party, fiscalRegime: 'R-99-PN', taxResponsibility: '01 - IVA' },
      issuerTaxProfile: { vatRegime: 'non_vat_responsible', economicActivity: '4923', source },
    }, qr: '' }))
    const suffix = source === 'current' ? ' (configuración actual)' : ''
    expect(text).toContain(`Régimen IVA${suffix}: No responsable de IVA`)
    expect(text).toContain(`Actividad económica${suffix}: 4923`)
    expect(text).toContain('Tributo (XML): 01 - IVA')
    expect(text).toContain('Responsabilidad fiscal (XML): R-99-PN')
  })

  it('muestra el nombre del producto y conserva su descripción en otra columna', () => {
    const item = { ...data.items[0], name: 'Activación de facturación', code: 'FV-01' }
    const text = textContent(SalesInvoicePdfDocument({ data: { ...data, items: [item] }, qr: '' }))
    expect(text).toContain(`1${item.name}${item.description}2`)
    expect(text).not.toContain(item.code)
  })

  it.each([4.14, 0, undefined])('muestra actividad completa y omite la tarifa ICA %s si no es positiva', icaRate => {
    const activity = '1410 - Confección de prendas de vestir, excepto prendas de piel'
    const text = textContent(SalesInvoicePdfDocument({ data: { ...data,
      issuer: { ...party, economicActivity: '1410' },
      issuerTaxProfile: { source: 'emission', economicActivity: activity, icaRate },
    }, qr: '' }))
    expect(text).toContain(`Actividad económica: ${activity}`)
    if (icaRate) expect(text).toContain(` · Tarifa ICA: ${icaRate} ‰`)
    else expect(text).not.toContain('Tarifa ICA:')
    expect(text.indexOf('Actividad económica:')).toBeGreaterThan(text.indexOf('Vigencia:'))
    expect(text.indexOf('CUFE:')).toBeGreaterThan(text.indexOf('Actividad económica:'))
  })
  it('respeta la actividad del XML si su código difiere y no inventa una tarifa histórica ausente', () => {
    const text = textContent(SalesInvoicePdfDocument({ data: { ...data,
      issuer: { ...party, economicActivity: '4923' },
      issuerTaxProfile: { source: 'emission', economicActivity: '1410 - Otra actividad' },
    }, qr: '' }))
    expect(text).toContain('Actividad económica: 4923')
    expect(text).not.toContain('Tarifa ICA:')
    expect(text).not.toContain('Otra actividad')
  })

  it.each([undefined, null, '', '   ', 'ABC'])('usa la descripción si el nombre es %s sin mostrar el código', name => {
    const item = { ...data.items[0], name }
    const text = textContent(SalesInvoicePdfDocument({ data: { ...data, items: [item] }, qr: '' }))
    expect(text).toContain(`1${item.description}${item.description}2`)
    expect(text).not.toContain(item.code!)
  })

  it('muestra el contado y el saldo a crédito con sus medios e importes', () => {
    const text = textContent(SalesInvoicePdfDocument({ data: { ...data, paymentBreakdown: [
      { methodId: 'cash', methodName: 'Efectivo', nextpymeMethodId: 10, negotiation: 'CASH', amount: 100 },
      { methodId: 'credit', methodName: 'Crédito clientes', nextpymeMethodId: 1, negotiation: 'CREDIT', amount: 114.2 },
    ] }, qr: '' }))
    expect(text).toContain('Forma de negociación: Contado y crédito')
    expect(text).toContain('Efectivo (Contado): 100,00')
    expect(text).toContain('Crédito clientes (Crédito): 114,20')
    expect(text).toContain('Fecha de vencimiento: 2026-10-01')
  })

  it('muestra todos los vendedores asignados y omite el campo en documentos antiguos', () => {
    const sellers = [{ id: 'seller-1', name: 'Laura Pérez' }, { id: 'seller-2', name: 'Juan Díaz' }]
    const text = textContent(SalesInvoicePdfDocument({ data: { ...data, sellers }, qr: '' }))
    expect(text).toContain('Vendedores: Laura Pérez, Juan Díaz')
    expect(textContent(SalesInvoicePdfDocument({ data, qr: '' }))).not.toContain('Vendedores:')
  })

  it.each([1039.5, 1011.24])('descuenta las tres retenciones sin restarlas dos veces cuando el total recibido es %s', total => {
    const text = textContent(SalesInvoicePdfDocument({ data: {
      ...data, subtotal: 990, taxExclusiveAmount: 990, taxInclusiveAmount: 1039.5, iva: 49.5, total,
      withholdings: [
        { dianTaxCode: '06', name: 'ReteFuente', percentage: 1, amount: 9.9 },
        { dianTaxCode: '07', name: 'ReteICA', percentage: 11.04, amount: 10.93 },
        { dianTaxCode: '05', name: 'ReteIVA', percentage: 15, amount: 7.43 },
      ],
    }, qr: '' }))
    expect(text).toContain('Total antes de retenciones:1.039,50')
    expect(text).toContain('Total neto a pagar:1.011,24')
    expect(text).not.toContain('Total neto a pagar:1.039,50')
    expect(text).toContain('MIL ONCE')
  })

  it('muestra el porcentaje de retención del documento cuando la línea no lo trae', () => {
    const text = textContent(SalesInvoicePdfDocument({
      data: {
        ...data,
        withholdings: [{ dianTaxCode: '06', name: 'ReteFuente', percentage: 3.5, amount: 260 }],
      },
      qr: '',
    }))
    expect(text).toContain('3.5')
    expect(text).toContain('-260,00')
  })

  it('adapta título, tercero y código único según el tipo de documento', () => {
    const text = textContent(SalesInvoicePdfDocument({
      data: { ...data, documentKind: 'SUPPORT_CREDIT_NOTE' },
      qr: '',
    }))
    expect(text).toContain('Nota de Ajuste')
    expect(text).toContain('CUDS:')
    expect(text).toContain('nota de ajuste al documento soporte electrónico')
    expect(text).not.toContain('CUFE:')
  })

  it('oculta el vencimiento en contado aunque el XML incluya una fecha', () => {
    const text = textContent(SalesInvoicePdfDocument({ data: { ...data, isCreditPayment: false }, qr: '' }))
    expect(text).not.toContain('Fecha de vencimiento:')
    expect(text).not.toContain(data.dueDate!)
  })

  it('muestra en crédito la fecha de vencimiento del documento', () => {
    const text = textContent(SalesInvoicePdfDocument({ data, qr: '' }))
    expect(text).toContain('Fecha de vencimiento: 2026-10-01')
  })

  it('envuelve un nombre largo en otra línea sin cortar la palabra', async () => {
    const longName = 'BORDA BELTRAN LAURA SOFIA'
    const buffer = await renderToBuffer(<SalesInvoicePdfDocument data={{
      ...data,
      issuer: { ...party, name: longName, tradeName: longName },
    }} qr="" />)
    const raw = buffer.toString('latin1')
    expect(raw).not.toMatch(/LAU-/)
    expect(raw).toContain('LAURA')
  }, 30000)

  it('renders the company logo in a real PDF', async () => {
    const logoDataUrl = await QRCode.toDataURL('company-logo-fixture')
    const buffer = await renderToBuffer(<SalesInvoicePdfDocument data={{ ...data, logoDataUrl }} qr={logoDataUrl} />)
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-')
    expect(buffer.toString('latin1')).toContain('/Subtype /Image')
  }, 30000)

  it.each([1, 70])('renders a real PDF for %i lines', async count => {
    const qr = await QRCode.toDataURL(data.dianQrText)
    const buffer = await renderToBuffer(<SalesInvoicePdfDocument data={{ ...data, items: Array.from({ length: count }, () => data.items[0]) }} qr={qr} />)
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-')
    const pages = buffer.toString('latin1').match(/\/Type \/Page\b/g)?.length ?? 0
    if (count === 1) expect(pages).toBe(1)
    else expect(pages).toBeGreaterThan(1)
  }, 30000)
})
