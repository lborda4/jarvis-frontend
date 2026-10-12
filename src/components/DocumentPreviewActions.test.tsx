import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import DocumentPreviewActions from './DocumentPreviewActions'

function render(kind: string) {
  return renderToStaticMarkup(<MemoryRouter><DocumentPreviewActions id="document/1" number="FVJ3" kind={kind} /></MemoryRouter>)
}

describe('acciones en la visualización de documentos', () => {
  it('abre la creación de notas débito y crédito con la factura seleccionada', () => {
    const html = render('ELECTRONIC_INVOICE')
    expect(html).toContain('href="/nota-debito/nueva?factura=document%2F1"')
    expect(html).toContain('href="/nota-credito/nueva?factura=document%2F1"')
    expect(html).toContain('Enviar a correo')
    expect(html).not.toContain('/nota-ajuste/nueva')
  })

  it('abre la creación de una nota de ajuste con el documento soporte seleccionado', () => {
    const html = render('SUPPORT_DOCUMENT')
    expect(html).toContain('href="/nota-ajuste/nueva?documento=document%2F1"')
    expect(html).toContain('Enviar a correo')
    expect(html).not.toContain('/nota-debito/nueva')
    expect(html).not.toContain('/nota-credito/nueva')
  })

  it.each(['CREDIT_NOTE', 'DEBIT_NOTE', 'SUPPORT_CREDIT_NOTE'])('permite correo para %s sin crear notas desde otras notas', kind => {
    const html = render(kind)
    expect(html).toContain('Enviar a correo')
    expect(html).not.toContain('/nueva?')
  })
})
