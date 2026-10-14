import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import RadianPage from './RadianPage'

vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { company: { id: 'company-1' } } }) }))
vi.mock('../services/jarvisService', () => ({ fetchJarvisTypeRejections: vi.fn() }))

beforeEach(() => {
  const invoice = { cufe: 'a'.repeat(96), number: 'FE1', supplier: 'Proveedor Uno', nit: '900001', date: '2026-10-13', valid: true, verified: false }
  vi.stubGlobal('localStorage', { getItem: (key: string) => key.endsWith(':invoices') ? JSON.stringify([invoice]) : null })
})
afterEach(() => vi.unstubAllGlobals())

it('ofrece consulta manual por CUFE e importación de Excel con tres columnas de eventos', () => {
  const html = renderToStaticMarkup(<RadianPage />)
  expect(html).toContain('Agregar factura por CUFE')
  expect(html).toContain('Consultar estados DIAN')
  expect(html).toContain('>Consultar</button>')
  expect(html).toContain('Importar Excel de la DIAN')
  expect(html).toMatch(/col[Ss]pan="3"/)
  expect(html).toContain('Aceptación / Reclamo')
  expect(html).not.toContain('<th>031')
  expect(html).toContain('FE1')
  expect(html).toMatch(/<option value="4" selected="">033 · Aceptación<\/option>/)
  expect(html).toContain('031 · Reclamo')
  const selection = html.match(/<input[^>]*aria-label="Seleccionar factura FE1"[^>]*>/)?.[0]
  expect(selection).toBeDefined()
  expect(selection).not.toContain('disabled')
})

it('ofrece reintento cuando la recepción falló después del acuse', () => {
  const cufe = 'a'.repeat(96)
  const invoice = { cufe, number: 'FE1', supplier: 'Proveedor', nit: '900001', date: '2026-10-13', valid: true }
  vi.stubGlobal('localStorage', { getItem: (key: string) => JSON.stringify(key.endsWith(':invoices') ? [invoice] : { [cufe]: { 1: 'sent', 3: 'failed' } }) })
  const html = renderToStaticMarkup(<RadianPage />)
  expect(html).toContain('Reintentar pendientes')
  const button = html.match(/<button[^>]*>Reintentar pendientes<\/button>/)?.[0]
  expect(button).toBeDefined()
  expect(button).not.toContain('disabled')
})
it('bloquea el reintento si otro evento está por confirmar', () => {
  const cufe = 'a'.repeat(96)
  const invoice = { cufe, number: 'FE1', supplier: 'Proveedor', nit: '900001', date: '2026-10-13', valid: true }
  vi.stubGlobal('localStorage', { getItem: (key: string) => JSON.stringify(key.endsWith(':invoices') ? [invoice] : { [cufe]: { 1: 'unknown', 3: 'failed' } }) })
  const html = renderToStaticMarkup(<RadianPage />)
  const button = html.match(/<button[^>]*>Reintentar pendientes<\/button>/)?.[0]
  expect(button).toContain('disabled')
})
