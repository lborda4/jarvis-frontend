import { describe, expect, it } from 'vitest'
import { renderToBuffer } from '@react-pdf/renderer'
import QRCode from 'qrcode'
import { renderPurchaseInvoicePdfDocument } from './PurchaseInvoicePdfDocument'
import type { PurchaseInvoiceDownload } from '../../types/electronicDocument'

const party = {
  name: 'Empresa de prueba',
  documentType: 'NIT',
  documentNumber: '001234567',
  checkDigit: null,
  address: null,
  phone: null,
  email: null,
  cityName: null,
}
const data: PurchaseInvoiceDownload = {
  id: 'test',
  cufe: 'cufe-test',
  invoiceNumber: 'TEST1',
  prefix: 'TEST',
  issueDate: '2026-09-01',
  dueDate: null,
  isCreditPayment: false,
  currency: 'COP',
  observations: 'Notas de prueba\nSegunda linea',
  issuer: party,
  buyer: party,
  items: [
    {
      description:
        'Producto con descripcion larga para verificar el ajuste de las celdas',
      code: '00001',
      unitCode: 'EA',
      quantity: 1,
      unitValue: 100,
      total: 100,
      discount: 0,
      ivaPercentage: 19,
      ivaAmount: 19,
    },
  ],
  subtotal: 100,
  iva: 19,
  discount: 0,
  total: 119,
  withholdings: [],
  dianQrText: 'CUFE: cufe-test',
  dianQrUrl: '',
}

describe('JARVIS invoice template', () => {
  it.each([6, 60])(
    'generates a paginated PDF with %i invoice lines',
    async (count) => {
      const qr = await QRCode.toDataURL(data.dianQrText)
      const invoice = {
        ...data,
        items: Array.from({ length: count }, (_, i) => ({
          ...data.items[0],
          code: `SKU${i}`,
        })),
      }
      const buffer = await renderToBuffer(
        renderPurchaseInvoicePdfDocument(invoice, qr),
      )
      expect(buffer.subarray(0, 5).toString()).toBe('%PDF-')
      const pages =
        buffer.toString('latin1').match(/\/Type \/Page\b/g)?.length ?? 0
      if (count === 6) expect(pages).toBe(2)
      else expect(pages).toBeGreaterThan(2)
    },
    30000,
  )
})
