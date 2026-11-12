import { describe, expect, it } from 'vitest'
import { DEFAULT_INVOICE_APPEARANCE, invoiceAppearanceColors, normalizeInvoiceAppearance, normalizeInvoiceColor } from './invoiceAppearance'
import { invoiceAppearanceSample } from './invoiceAppearanceSample'

describe('personalización de facturas', () => {
  it.each([['#abc', '#AABBCC'], [' 123456 ', '#123456'], ['#0d9488', '#0D9488']])('normaliza %s', (input, output) => {
    expect(normalizeInvoiceColor(input)).toBe(output)
  })
  it.each(['', '#12', '#12345678', 'red', 'url(example.com)', '#12zz00'])('rechaza un color inválido %s', input => {
    expect(normalizeInvoiceColor(input)).toBeNull()
  })
  it('recupera valores seguros ante preferencias ausentes o inválidas', () => {
    expect(normalizeInvoiceAppearance()).toEqual(DEFAULT_INVOICE_APPEARANCE)
    expect(normalizeInvoiceAppearance({ accentColor: 'red', footerText: ' x '.repeat(200) }).footerText).toHaveLength(300)
  })
  it('mantiene contraste en fondos claros y oscuros', () => {
    expect(invoiceAppearanceColors({ accentColor: '#FFFFFF' }).onAccent).toBe('#000000')
    expect(invoiceAppearanceColors({ accentColor: '#000000' }).onAccent).toBe('#FFFFFF')
    const light = invoiceAppearanceColors({ accentColor: '#FFFFFF' })
    const channel = parseInt(light.heading.slice(1, 3), 16) / 255
    const luminance = ((channel + .055) / 1.055) ** 2.4
    expect(1.05 / (luminance + .05)).toBeGreaterThanOrEqual(4.5)
  })
  it('genera una prueba sin número real, CUFE ni datos de validación', () => {
    const sample = invoiceAppearanceSample({ id: 'company', name: 'Mi empresa', nit: '123' }, {}, DEFAULT_INVOICE_APPEARANCE, null)
    expect(sample).toMatchObject({ isDraft: true, isPreviewSample: true, cufe: '', dianQrText: '', invoiceNumber: 'DEMO-001', total: 357000 })
    expect(sample.issuer.name).toBe('Mi empresa')
    expect(sample.items.reduce((total, item) => total + item.total + (item.ivaAmount ?? 0), 0)).toBe(sample.total)
  })
})
