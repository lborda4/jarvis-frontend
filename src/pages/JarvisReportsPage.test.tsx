import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import JarvisReportsPage from './JarvisReportsPage'

const setup = vi.hoisted(() => ({ isCheckingSetup: false, isJarvisCompany: true, setupPath: '/configuracion/integracion-siigo' }))
vi.mock('../context/IntegrationSetupContext', () => ({ useIntegrationSetup: () => setup }))
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { company: { id: 'company-a' } } }) }))
beforeEach(() => { setup.isCheckingSetup = false; setup.isJarvisCompany = true })
const render = () => renderToStaticMarkup(<MemoryRouter><JarvisReportsPage /></MemoryRouter>)

it('ofrece los cinco reportes y filtros antes de consultar', () => {
  const html = render()
  for (const label of ['Ventas generales', 'Ventas por cliente', 'Ventas por producto', 'Ventas por vendedor', 'Impuestos y retenciones', 'Registros individuales', 'Exportar a Excel']) expect(html).toContain(label)
  expect(html).toContain('Consultando registros')
  expect(html).not.toContain('<tbody>')
})
it('no muestra reportes JARVIS en empresas SIIGO', () => {
  setup.isJarvisCompany = false
  expect(render()).not.toContain('Ventas generales')
})
it('espera a identificar la integración', () => {
  setup.isCheckingSetup = true
  expect(render()).toContain('Cargando reportes')
  expect(render()).not.toContain('Ventas generales')
})
