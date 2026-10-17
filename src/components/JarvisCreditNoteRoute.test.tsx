import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import JarvisCreditNoteRoute from './JarvisCreditNoteRoute'
import Sidebar from '../layout/Sidebar'

const setup = vi.hoisted(() => ({
  isCheckingSetup: false,
  isJarvisCompany: false,
  isCreditNoteEnabled: true,
  documentQuotas: {},
  integrationMode: 'siigo',
  setupPath: '/configuracion/integracion-siigo',
}))
vi.mock('../context/IntegrationSetupContext', () => ({ useIntegrationSetup: () => setup }))
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { name: 'Usuario', role: 'USER' }, companies: [] }),
}))

beforeEach(() => {
  Object.assign(setup, {
    isCheckingSetup: false,
    isJarvisCompany: false,
    isCreditNoteEnabled: true,
    integrationMode: 'siigo',
    setupPath: '/configuracion/integracion-siigo',
  })
})

function renderRoute(path: string) {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<JarvisCreditNoteRoute />}>
          <Route path="/nota-credito" element={<p>Listado de notas crédito</p>} />
          <Route path="/nota-credito/nueva" element={<p>Crear nota crédito</p>} />
          <Route path="/nota-credito/:id/visualizar" element={<p>Visualizar nota crédito</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

it.each(['/nota-credito', '/nota-credito/nueva', '/nota-credito/doc-1/visualizar'])(
  'impide abrir %s en SIIGO aunque tenga notas habilitadas en datos anteriores', (path) => {
    expect(renderRoute(path)).not.toContain('nota')
  },
)

it.each([
  ['/nota-credito', 'Listado de notas crédito'],
  ['/nota-credito/nueva', 'Crear nota crédito'],
  ['/nota-credito/doc-1/visualizar', 'Visualizar nota crédito'],
])('permite abrir %s en JARVIS', (path, text) => {
  Object.assign(setup, { isJarvisCompany: true, integrationMode: 'jarvis' })
  expect(renderRoute(path)).toContain(text)
})

it('espera a identificar la integración antes de mostrar las notas', () => {
  Object.assign(setup, { isCheckingSetup: true, isJarvisCompany: true })
  const html = renderRoute('/nota-credito')
  expect(html).toContain('Cargando...')
  expect(html).not.toContain('Listado de notas crédito')
})

it('oculta notas crédito en el menú SIIGO incluso con un indicador anterior habilitado', () => {
  const html = renderToStaticMarkup(
    <MemoryRouter initialEntries={['/nota-credito']}>
      <Sidebar isOpen onClose={() => {}} onOpen={() => {}} />
    </MemoryRouter>,
  )
  expect(html).toContain('Configuración SIIGO')
  expect(html).not.toContain('/nota-credito')
})

it('conserva notas crédito dentro de Documentos electrónicos en JARVIS', () => {
  Object.assign(setup, { isJarvisCompany: true, integrationMode: 'jarvis' })
  const html = renderToStaticMarkup(
    <MemoryRouter initialEntries={['/nota-credito']}>
      <Sidebar isOpen onClose={() => {}} onOpen={() => {}} />
    </MemoryRouter>,
  )
  expect(html).toContain('Documentos electrónicos')
  expect(html).toContain('href="/nota-credito"')
})
