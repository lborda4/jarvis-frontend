import { describe, expect, it } from 'vitest'
import {
  buildDianCatalogQrUrl,
  buildDianInvoiceQrText,
  buildPurchaseInvoicePdfFilename,
} from './dianInvoiceQr'

describe('buildDianCatalogQrUrl', () => {
  it('arma la URL del catálogo DIAN con el CUFE escapado', () => {
    expect(buildDianCatalogQrUrl('cufe/abc')).toBe(
      'https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=cufe%2Fabc',
    )
  })
})

describe('buildDianInvoiceQrText', () => {
  const base = {
    invoiceNumber: 'SETP990000001',
    issueDate: '2026-07-21',
    issuerNit: '902086460',
    buyerNit: '900123456',
    subtotal: 100000,
    iva: 19000,
    total: 119000,
    cufe: 'cufe-123',
  }

  it('arma el bloque Anexo UBL 2.1 sin HorFac cuando no hay hora', () => {
    const text = buildDianInvoiceQrText(base)

    expect(text).toContain('NumFac: SETP990000001')
    expect(text).toContain('DocAdq: 900123456')
    expect(text).toContain('ValFac: 100000.00')
    expect(text).not.toContain('HorFac')
  })

  it('incluye HorFac solo cuando viene una hora real', () => {
    expect(buildDianInvoiceQrText({ ...base, issueTime: '14:30:00' })).toContain(
      'HorFac: 14:30:00',
    )
  })
})

describe('buildPurchaseInvoicePdfFilename', () => {
  it('usa el número de factura sanitizado', () => {
    expect(buildPurchaseInvoicePdfFilename('SETP 990000001', 'cufe-123')).toBe(
      'factura-SETP_990000001.pdf',
    )
  })

  it('cae al CUFE si no hay número', () => {
    expect(buildPurchaseInvoicePdfFilename(null, 'abcdefghijklmno')).toBe(
      'factura-abcdefghijkl.pdf',
    )
  })
})
