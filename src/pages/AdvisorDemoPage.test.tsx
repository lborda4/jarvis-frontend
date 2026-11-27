import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { expect, it, vi } from 'vitest'
import AdvisorDemoPage from './AdvisorDemoPage'
import AdvisorAccountPage from './AdvisorAccountPage'

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'advisor', name: 'Asesor', role: 'advisor' }, isAuthenticated: true, isLoading: false, logout: vi.fn() }),
}))

it('ofrece el acceso a la demo en el panel comercial', () => {
  const html = renderToStaticMarkup(<MemoryRouter><AdvisorAccountPage /></MemoryRouter>)
  expect(html).toContain('href="/asesor/demo"')
  expect(html).toContain('Ir a la aplicación demo')
})

it('presenta la navegación de facturación y señala lo que aún no está disponible', () => {
  const html = renderToStaticMarkup(<MemoryRouter><AdvisorDemoPage /></MemoryRouter>)
  expect(html).toContain('Facturación electrónica')
  expect(html).toContain('Documentos electrónicos')
  expect(html).toContain('Facturas de venta')
  expect(html).toContain('aria-disabled="true"')
  expect(html).toContain('no se conecta a NextPyme ni a la DIAN')
  expect(html).toContain('href="/asesor"')
  expect(html).not.toContain('href="/factura-venta"')
})
