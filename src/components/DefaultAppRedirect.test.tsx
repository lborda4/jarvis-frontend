import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { expect, it, vi } from 'vitest'
import DefaultAppRedirect from './DefaultAppRedirect'

const setup = vi.hoisted(() => ({ isCheckingSetup: false, requiresSetup: true, setupPath: '/configuracion/integracion-jarvis', isJarvisCompany: true, isSupportDocumentEnabled: false, integrationMode: 'jarvis' }))
const auth = vi.hoisted(() => ({ user: { company: { jarvisModules: undefined as ('BILLING' | 'PAYROLL')[] | undefined } } }))
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth }))
vi.mock('../context/IntegrationSetupContext', () => ({ useIntegrationSetup: () => setup }))
vi.mock('../pages/JarvisDashboardPage', () => ({ default: () => <p>Tablero de inicio Jarvis</p> }))
it('abre el tablero Jarvis al entrar aunque la configuración esté pendiente', () => {
  expect(renderToStaticMarkup(<MemoryRouter><DefaultAppRedirect /></MemoryRouter>)).toContain('Tablero de inicio Jarvis')
})
