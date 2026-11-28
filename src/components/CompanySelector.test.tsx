import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import type { AuthCompany } from '../types/auth'
import CompanySelector from './CompanySelector'

const state = vi.hoisted(() => ({ role: 'advisor', companies: [{ id: 'real', name: 'Empresa real', nit: '123' }] as AuthCompany[], active: undefined as AuthCompany | undefined }))
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { role: state.role, company: state.active ?? state.companies[0] }, companies: state.companies, switchCompany: vi.fn() }),
}))
beforeEach(() => { state.role = 'advisor'; state.companies = [{ id: 'real', name: 'Empresa real', nit: '123' }]; state.active = undefined })

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
  expect(html).not.toContain('Empresa demo Jarvis')
})

it('mantiene la demo disponible para comerciales sin empresas reales', () => {
  state.companies = []
  const html = renderToStaticMarkup(<MemoryRouter><CompanySelector location="panel" /></MemoryRouter>)
  expect(html).toContain('Empresa demo Jarvis')
  expect(html).toContain('aria-label="Empresa activa"')
})

it('identifica la sesión demo y no duplica la empresa compartida en el selector', () => {
  const demo = { id: 'shared-demo', name: 'Empresa demo Jarvis', nit: '900000000', isDemo: true }
  state.companies.push(demo)
  state.active = demo
  const html = renderToStaticMarkup(<MemoryRouter><CompanySelector location="company" /></MemoryRouter>)
  expect(html).toContain('value="__advisor_demo__" selected=""')
  expect(html).not.toContain('value="shared-demo"')
  expect(html).toContain('Empresa real')
})
