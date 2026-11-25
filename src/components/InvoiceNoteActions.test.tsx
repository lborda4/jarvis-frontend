import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { expect, it, vi } from 'vitest'
import { InvoiceNoteMenuItems } from './InvoiceNoteActions'

it('ofrece descargar XML junto con las acciones de una factura enviada', () => {
  const html = renderToStaticMarkup(<MemoryRouter><InvoiceNoteMenuItems invoiceId="invoice" number="FE1" onDownload={vi.fn()} onDownloadXml={vi.fn()} onClose={vi.fn()} /></MemoryRouter>)
  expect(html).toContain('Descargar XML de factura FE1')
  expect(html).toContain('Descargar factura FE1')
  expect(html).toContain('Nota débito')
  expect(html).toContain('Nota crédito')
})

it('no ofrece XML para documentos soporte', () => {
  const html = renderToStaticMarkup(<MemoryRouter><InvoiceNoteMenuItems invoiceId="support" number="DS1" supportDocument onClose={vi.fn()} /></MemoryRouter>)
  expect(html).not.toContain('Descargar XML')
  expect(html).toContain('Nota de ajuste')
})
