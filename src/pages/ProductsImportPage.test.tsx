import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import ProductsImportPage from './ProductsImportPage'
import ProductListPage from './ProductListPage'
import { companyQueryKey, setActiveCompanyId, setCachedQuery } from '../services/queryCache'

vi.mock('../components/CreateProductModal', () => ({ default: () => null }))
beforeEach(() => {
  setActiveCompanyId('products-company')
  setCachedQuery(companyQueryKey(['products', 'list']), { items: [], total: 0 })
})

it('habilita el enlace de carga masiva de productos desde el catálogo', () => {
  const html = renderToStaticMarkup(<MemoryRouter><ProductListPage /></MemoryRouter>)
  expect(html).toContain('href="/productos/importar"')
  expect(html).toContain('Importar productos</a>')
  expect(html).toContain('Crear producto')
})

it('presenta plantilla, carga y revisión de productos en una pantalla completa', () => {
  const html = renderToStaticMarkup(<MemoryRouter><ProductsImportPage /></MemoryRouter>)
  expect(html).toContain('<h1>Importar productos</h1>')
  expect(html).toContain('Descargar plantilla')
  expect(html).toContain('Subir Excel')
  expect(html).toContain('type="file"')
  expect(html).toContain('>Productos</h2>')
  expect(html).toContain('Volver al listado')
  expect(html).not.toContain('role="dialog"')
})
