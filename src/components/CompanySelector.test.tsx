import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { expect, it, vi } from 'vitest'
import CompanySelector from './CompanySelector'

const state = vi.hoisted(() => ({ role: 'advisor', companies: [{ id: 'real', name: 'Empresa real', nit: '123' }] }))
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { role: state.role, company: state.companies[0] }, companies: state.companies, switchCompany: vi.fn() }),
}))

it('presenta la demo y las empresas vinculadas en el mismo selector', () => {
  state.role = 'advisor'
  for (const location of ['panel', 'demo', 'company'] as const) {
    const html = renderToStaticMarkup(<MemoryRouter><CompanySelector location={location} demoName="Empresa de prueba" /></MemoryRouter>)
    expect(html).toContain('Empresa de prueba')
    expect(html).toContain('Empresa real')
    expect(html).toContain('aria-label="Empresa activa"')
  }
})

it('no muestra la demo a usuarios normales', () => {
  state.role = 'user'
  const html = renderToStaticMarkup(<MemoryRouter><CompanySelector location="company" /></MemoryRouter>)
  expect(html).toContain('Empresa real')
  expect(html).not.toContain('Aplicación demo')
})
