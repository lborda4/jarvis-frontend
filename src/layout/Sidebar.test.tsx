import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { expect, it, vi } from 'vitest'
import Sidebar from './Sidebar'
import type { JarvisModule } from '../types/companyModules'

const state = vi.hoisted(() => ({ modules: undefined as JarvisModule[] | undefined }))
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({
  user: { name: 'Usuario', email: 'user@example.com', company: { id: 'company', name: 'Empresa', jarvisModules: state.modules } },
  companies: [], logout: vi.fn(), switchCompany: vi.fn(),
}) }))
vi.mock('../context/IntegrationSetupContext', () => ({ useIntegrationSetup: () => ({
  isJarvisCompany: true, integrationMode: 'jarvis', documentQuotas: {},
  setupPath: '/configuracion/integracion-jarvis',
}) }))

function render(modules?: JarvisModule[]) {
  state.modules = modules
  return renderToStaticMarkup(<MemoryRouter><Sidebar isOpen onClose={() => {}} onOpen={() => {}} /></MemoryRouter>)
}
it('oculta nómina cuando solo se elige facturación', () => {
  const html = render(['BILLING'])
  expect(html).toContain('Documentos electrónicos')
  expect(html).not.toContain('Nómina electrónica')
})
it('oculta facturación y sus catálogos cuando solo se elige nómina', () => {
  const html = render(['PAYROLL'])
  expect(html).toContain('Nómina electrónica')
  expect(html).not.toContain('Documentos electrónicos')
  expect(html).not.toContain('Categorías')
  expect(html).not.toContain('Reportes')
})
it('conserva ambos módulos para empresas existentes', () => {
  const html = render()
  expect(html).toContain('Documentos electrónicos')
  expect(html).toContain('Nómina electrónica')
})
