import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('carga del generador PDF después de un despliegue', () => {
  beforeEach(() => vi.resetModules())
  afterEach(() => vi.doUnmock('./salesInvoicePdf'))

  it('identifica un módulo no disponible para que Reintentar recargue la aplicación', async () => {
    const cause = new TypeError('Failed to fetch dynamically imported module: /assets/salesInvoicePdf-old.js')
    vi.doMock('./salesInvoicePdf', () => { throw cause })
    const { loadSalesInvoicePdfRenderer, PdfModuleLoadError } = await import('./loadSalesInvoicePdfRenderer')
    const error = await loadSalesInvoicePdfRenderer().catch(error => error)
    expect(error).toBeInstanceOf(PdfModuleLoadError)
    // Vitest wraps a rejected mock factory; the browser keeps the cause directly.
    expect(error.cause === cause || error.cause?.cause === cause).toBe(true)
  })

  it('devuelve el generador cuando el módulo está disponible', async () => {
    const generateSalesInvoicePdf = vi.fn()
    vi.doMock('./salesInvoicePdf', () => ({ generateSalesInvoicePdf }))
    const { loadSalesInvoicePdfRenderer } = await import('./loadSalesInvoicePdfRenderer')
    expect((await loadSalesInvoicePdfRenderer()).generateSalesInvoicePdf).toBe(generateSalesInvoicePdf)
  })

  it('conserva los errores de generación sin confundirlos con un módulo antiguo', async () => {
    const cause = new Error('No se pudo generar esta factura')
    vi.doMock('./salesInvoicePdf', () => ({ generateSalesInvoicePdf: vi.fn().mockRejectedValue(cause) }))
    const { loadSalesInvoicePdfRenderer, PdfModuleLoadError } = await import('./loadSalesInvoicePdfRenderer')
    const renderer = await loadSalesInvoicePdfRenderer()
    const error = await renderer.generateSalesInvoicePdf({} as never).catch(error => error)
    expect(error).toBe(cause)
    expect(error).not.toBeInstanceOf(PdfModuleLoadError)
  })
})
