import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { expect, it } from 'vitest'
import { SearchBox } from './GlobalSearch'
import type { SearchAccess } from '../services/globalSearchService'

const access: SearchAccess = { companyId: 'a', provider: 'JARVIS', sales: true, support: true, purchases: false, products: true, thirdParties: true }
it('presenta un buscador accesible con las categorías habilitadas para la empresa', () => {
  const html = renderToStaticMarkup(<MemoryRouter><SearchBox access={access} /></MemoryRouter>)
  expect(html).toContain('role="search"')
  expect(html).toContain('aria-label="Buscar en la empresa"')
  expect(html).toContain('>Todos</option>')
  expect(html).toContain('>Facturas de venta</option>')
  expect(html).toContain('>Documentos soporte</option>')
  expect(html).toContain('>Terceros</option>')
  expect(html).not.toContain('>Facturas de compra</option>')
  expect(html).not.toContain('role="dialog"')
})

it('no muestra categorías del módulo de facturación cuando la empresa no las tiene habilitadas', () => {
  const html = renderToStaticMarkup(<MemoryRouter><SearchBox access={{ ...access, sales: false, support: false, thirdParties: false, products: false }} disabled /></MemoryRouter>)
  expect(html).not.toContain('>Facturas de venta</option>')
  expect(html).not.toContain('>Terceros</option>')
  expect(html).toContain('disabled')
})
