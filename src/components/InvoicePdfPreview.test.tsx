import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import InvoicePdfPreview from './InvoicePdfPreview'

it('separa el título visual del nombre de descarga oficial', () => {
  const html = renderToStaticMarkup(<InvoicePdfPreview standalone number="FV001" displayNumber="FV-001" pdfUrl="blob:test" onClose={vi.fn()} />)
  expect(html).toContain('Factura FV-001</h1>')
  expect(html).toContain('download="Factura-FV001.pdf"')
})

it('conserva el título original cuando no se especifica un formato visual', () => {
  const html = renderToStaticMarkup(<InvoicePdfPreview standalone number="DS001" onClose={vi.fn()} />)
  expect(html).toContain('Factura DS001</h1>')
})
