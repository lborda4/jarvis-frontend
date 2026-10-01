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

  it('oculta el vencimiento en contado aunque el XML incluya una fecha', () => {
    const text = textContent(SalesInvoicePdfDocument({ data: { ...data, isCreditPayment: false }, qr: '' }))
    expect(text).not.toContain('Fecha de vencimiento:')
    expect(text).not.toContain(data.dueDate!)
  })

  it('muestra en crédito la fecha de vencimiento del documento', () => {
    const text = textContent(SalesInvoicePdfDocument({ data, qr: '' }))
    expect(text).toContain('Fecha de vencimiento: 2026-10-01')
  })

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
