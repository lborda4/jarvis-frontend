import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import IntegrationPolicyGate from './IntegrationPolicyGate'
const setup = vi.hoisted(() => ({ mode: 'jarvis', checking: false }))
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user', company: { id: 'company' } }, logout: vi.fn(), isLoading: false }) }))
vi.mock('../context/IntegrationSetupContext', () => ({ useIntegrationSetup: () => ({ integrationMode: setup.mode, isCheckingSetup: setup.checking }), useIsJarvisIntegration: () => true }))
it.each(['jarvis', 'siigo'])('consulta al servidor antes de mostrar la pol?tica de %s', mode => {
  setup.mode = mode
  const html = renderToStaticMarkup(<IntegrationPolicyGate><p>Aplicaci?n</p></IntegrationPolicyGate>)
  expect(html).toContain('Consultando')
  expect(html).not.toContain('role="dialog"')
  expect(html).not.toContain('<p>Aplicaci?n</p>')
})
