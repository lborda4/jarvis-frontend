import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { expect, it } from 'vitest'
import SupportDocumentsImportPage from './SupportDocumentsImportPage'
import ExcelImportLayout from '../components/ExcelImportLayout'

it('abre la importación como página con plantilla y carga del Excel disponibles desde el inicio', () => {
  const html = renderToStaticMarkup(<MemoryRouter><SupportDocumentsImportPage /></MemoryRouter>)
  expect(html).toContain('<main')
  expect(html).toContain('<h1>Importar documentos soporte</h1>')
  expect(html).toContain('Descargar plantilla')
  expect(html).toContain('type="file"')
  expect(html).toContain('Sube un Excel para comenzar.')
  expect(html).not.toContain('role="dialog"')
  expect(html).not.toContain('Continuar')
  expect(html).not.toContain('Cancelar')
})

it.each([false, true])('mantiene plantilla, carga y tabla visibles juntas al revisar el Excel (busy: %s)', busy => {
  const noop = () => {}
  const html = renderToStaticMarkup(<ExcelImportLayout presentation="page" title="Importar documentos soporte" description="Importación"
    templateDescription="Completa la plantilla" reviewDescription="Revisa los registros" className="support-import"
    fileName="soportes.xlsx" hasPreview busy={busy} importLabel="Enviar 1 documento a DIAN" importDisabled={false} finished={false}
    onDownload={noop} onFile={noop} onImport={noop} onClose={noop}>
    <table><tbody><tr><td>900123456</td><td>Mi empresa</td></tr></tbody></table>
  </ExcelImportLayout>)
  expect(html).toContain('Descargar plantilla')
  expect(html).toContain('type="file"')
  expect(html).toContain('<table>')
  expect(html).toContain('Mi empresa')
  expect(html).not.toContain('role="dialog"')
  const sendButton = html.match(/<button[^>]*>Enviar 1 documento a DIAN<\/button>/)?.[0]
  expect(sendButton).toBeDefined()
  expect(sendButton?.includes('disabled=""')).toBe(busy)
})
