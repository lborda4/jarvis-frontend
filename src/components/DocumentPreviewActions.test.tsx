import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import DocumentPreviewActions from './DocumentPreviewActions'

function render(kind: string) {
  return renderToStaticMarkup(<MemoryRouter><DocumentPreviewActions id="document/1" number="FVJ3" kind={kind} /></MemoryRouter>)
}

describe('acciones en la visualización de documentos', () => {
  it('ofrece verificar RADIAN antes de crear notas débito y crédito', () => {
    const html = render('ELECTRONIC_INVOICE')
    expect(html).toContain('Nota Débito</button>')
    expect(html).toContain('Nota Crédito</button>')
    expect(html).not.toContain('href="/nota-debito/nueva')
    expect(html).not.toContain('href="/nota-credito/nueva')
    expect(html).toContain('Enviar correo')
    expect(html).toContain('aria-label="Más opciones"')
    expect(html).toContain('Descargar XML')
    const menu = html.slice(html.indexOf('<details'), html.indexOf('</details>'))
    for (const action of ['Enviar correo', 'Duplicar', 'Nota Débito', 'Nota Crédito', 'Descargar XML']) expect(menu).toContain(action)
    expect(menu).toContain('href="/factura-venta/nueva?duplicar=document%2F1"')
    expect(html).not.toContain('/nota-ajuste/nueva')
  })

  it('abre la creación de una nota de ajuste con el documento soporte seleccionado', () => {
    const html = render('SUPPORT_DOCUMENT')
    expect(html).toContain('href="/nota-ajuste/nueva?documento=document%2F1"')
    expect(html).toContain('Enviar correo')
    expect(html).not.toContain('Descargar XML')
    expect(html).not.toContain('Duplicar')
    expect(html).not.toContain('/nota-debito/nueva')
    expect(html).not.toContain('/nota-credito/nueva')
  })

  it.each(['CREDIT_NOTE', 'DEBIT_NOTE', 'SUPPORT_CREDIT_NOTE'])('permite correo para %s sin crear notas desde otras notas', kind => {
    const html = render(kind)
    expect(html).toContain('Enviar correo')
    expect(html).not.toContain('Descargar XML')
    expect(html).not.toContain('Duplicar')
    expect(html).not.toContain('/nueva?')
  })
})
