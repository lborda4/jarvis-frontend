import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import TercerosImportPage from './TercerosImportPage'
import TercerosPage from './TercerosPage'
import TercerosRoute from '../components/TercerosRoute'

const setup = vi.hoisted(() => ({ isJarvisCompany: true, isCheckingSetup: false, isCreditNoteEnabled: false, isConfigured: true, integrationMode: 'jarvis', setupPath: '/configuracion/integracion-jarvis' }))
vi.mock('../context/IntegrationSetupContext', () => ({ useIntegrationSetup: () => setup }))
vi.mock('../components/CreateJarvisTerceroModal', () => ({ default: () => null }))

beforeEach(() => {
  setup.isJarvisCompany = true
  setup.isConfigured = true
  setup.isCheckingSetup = false
  setup.isCreditNoteEnabled = false
})

it('habilita el enlace de importación con el tamaño estándar desde el listado de terceros', () => {
  const html = renderToStaticMarkup(<MemoryRouter><TercerosPage /></MemoryRouter>)
  expect(html).toContain('class="btn btn--outline btn--md" href="/terceros/importar"')
  expect(html).toContain('Importar terceros</a>')
  expect(html).toContain('Crear tercero')
})

it('presenta plantilla, carga y revisión en una pantalla completa, sin modal', () => {
  const html = renderToStaticMarkup(<MemoryRouter><TercerosImportPage /></MemoryRouter>)
  expect(html).toContain('<h1>Importar terceros</h1>')
  expect(html).toContain('Descargar plantilla')
  expect(html).toContain('Subir Excel')
  expect(html).toContain('type="file"')
  expect(html).toContain('>Terceros</h2>')
  expect(html).toContain('Volver al listado')
  expect(html).not.toContain('role="dialog"')
})

it('protege la pantalla de importación con la configuración y el proveedor Jarvis', () => {
  const render = () => renderToStaticMarkup(<MemoryRouter><TercerosRoute importing /></MemoryRouter>)
  expect(render()).toContain('<h1>Importar terceros</h1>')
  setup.isConfigured = false
  expect(render()).not.toContain('<h1>Importar terceros</h1>')
  setup.isConfigured = true
  setup.isJarvisCompany = false
  setup.isCreditNoteEnabled = true
  expect(render()).not.toContain('<h1>Importar terceros</h1>')
  expect(renderToStaticMarkup(<MemoryRouter><TercerosPage /></MemoryRouter>)).not.toContain('href="/terceros/importar"')
})
