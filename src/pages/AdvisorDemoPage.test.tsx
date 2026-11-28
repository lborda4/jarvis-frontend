import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { expect, it, vi } from 'vitest'
import AdvisorDemoPage from './AdvisorDemoPage'
import AdvisorAccountPage from './AdvisorAccountPage'

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'advisor', name: 'Asesor', role: 'advisor' }, companies: [], isAuthenticated: true, isLoading: false, logout: vi.fn() }),
}))

it('ofrece el acceso a la demo en el panel comercial', () => {
  const html = renderToStaticMarkup(<MemoryRouter><AdvisorAccountPage /></MemoryRouter>)
  expect(html).toContain('href="/asesor/demo"')
  expect(html).toContain('Ir a la aplicación demo')
})

it('abre una sesión de empresa sin renderizar una aplicación demo distinta', () => {
  const html = renderToStaticMarkup(<MemoryRouter><AdvisorDemoPage /></MemoryRouter>)
  expect(html).toContain('Abriendo empresa demo compartida')
  expect(html).not.toContain('aria-disabled="true"')
  expect(html).not.toContain('Facturas de venta simuladas')
  expect(html).not.toContain('href="/factura-venta"')
})
