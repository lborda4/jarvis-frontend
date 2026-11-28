import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import Sidebar from './Sidebar'
import type { JarvisModule } from '../types/companyModules'

const state = vi.hoisted(() => ({ modules: undefined as JarvisModule[] | undefined, role: 'user' }))
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({
  user: { name: 'Usuario', role: state.role, email: 'user@example.com', company: { id: 'company', name: 'Empresa', jarvisModules: state.modules } },
  companies: [], logout: vi.fn(), switchCompany: vi.fn(),
}) }))
vi.mock('../context/IntegrationSetupContext', () => ({ useIntegrationSetup: () => ({
  isJarvisCompany: true, integrationMode: 'jarvis', documentQuotas: {},
  setupPath: '/configuracion/integracion-jarvis',
}) }))

beforeEach(() => { state.role = 'user' })
function render(modules?: JarvisModule[], pathname = '/') {
  state.modules = modules
  return renderToStaticMarkup(<MemoryRouter initialEntries={[pathname]}><Sidebar isOpen onClose={() => {}} onOpen={() => {}} /></MemoryRouter>)
}
it('oculta nómina cuando solo se elige facturación', () => {
  const html = render(['BILLING'])
  expect(html).toContain('Documentos electrónicos')
  expect(html).not.toContain('Nómina electrónica')
})
it('permite al comercial regresar a su panel desde la aplicación', () => {
  state.role = 'advisor'
  const html = render(['BILLING'])
  expect(html).toContain('href="/asesor"')
  expect(html).toContain('Panel comercial')
  expect(html).not.toContain('href="/admin"')
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

it('muestra solo nóminas y empleados en el menú desplegado de nómina', () => {
  const html = render(['PAYROLL'], '/nomina')
  expect(html).toContain('href="/nomina"')
  expect(html).toContain('href="/nomina/empleados"')
  expect(html).not.toContain('href="/nomina/configuracion"')
})
