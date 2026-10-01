import { describe, expect, it } from 'vitest'
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
  it.each([1, 70])('renders a real PDF for %i lines', async count => {
    const qr = await QRCode.toDataURL(data.dianQrText)
    const buffer = await renderToBuffer(<SalesInvoicePdfDocument data={{ ...data, items: Array.from({ length: count }, () => data.items[0]) }} qr={qr} />)
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-')
    const pages = buffer.toString('latin1').match(/\/Type \/Page\b/g)?.length ?? 0
    if (count === 1) expect(pages).toBe(1)
    else expect(pages).toBeGreaterThan(1)
  }, 30000)
})
