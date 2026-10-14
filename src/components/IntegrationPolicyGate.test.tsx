import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import IntegrationPolicyGate from './IntegrationPolicyGate'
import { getIntegrationPolicy } from '../constants/integrationPolicies'
import { saveIntegrationPolicyAcceptance } from '../utils/integrationPolicyAcceptance'

const setup = vi.hoisted(() => ({ mode: 'jarvis', checking: false }))
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-1', company: { id: 'company-1' } }, logout: vi.fn() }) }))
vi.mock('../context/IntegrationSetupContext', () => ({ useIntegrationSetup: () => ({ integrationMode: setup.mode, isCheckingSetup: setup.checking }) }))

function render() {
  return renderToStaticMarkup(<IntegrationPolicyGate><p>Contenido de la aplicación</p></IntegrationPolicyGate>)
}

describe('política al ingresar por integración', () => {
  beforeEach(() => {
    setup.mode = 'jarvis'; setup.checking = false
    const entries = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (key: string) => entries.get(key) ?? null, setItem: (key: string, value: string) => entries.set(key, value) })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('no vuelve a solicitar una política aceptada tras remontar la aplicación', () => {
    saveIntegrationPolicyAcceptance(`user-1:company-1:${getIntegrationPolicy('jarvis')!.id}`)
    for (let attempt = 0; attempt < 2; attempt++) {
      const html = render()
      expect(html).toContain('Contenido de la aplicación')
      expect(html).not.toContain('role="dialog"')
    }
  })

  it.each([
    'other-user:company-1:jarvis-terms-2026-10-08-v1',
    'user-1:other-company:jarvis-terms-2026-10-08-v1',
    'user-1:company-1:old-policy-version',
  ])('no reutiliza la aceptación de otro usuario, empresa o versión (%s)', key => {
    saveIntegrationPolicyAcceptance(key)
    expect(render()).toContain('role="dialog"')
  })

  it('muestra el texto Jarvis y solicita aceptación antes de entrar', () => {
    const html = render()
    expect(html).toContain('role="dialog"')
    expect(html).toContain('ARTÍCULO 1. IDENTIFICACIÓN Y NATURALEZA DEL SERVICIO')
    expect(html).toContain('ARTÍCULO 24. CONTACTO Y NOTIFICACIONES')
    expect(html).toContain('aria-label="Desplazarse hasta el final del documento"')
    expect(html).not.toContain('Ir al final ↓')
    expect(html).toMatch(/<button[^>]*disabled[^>]*>He leído y acepto<\/button>/)
    expect(html).toContain('Cerrar sesión')
    expect(html).not.toContain('Contenido de la aplicación')
  })

  it('no presenta la política Jarvis a empresas SIIGO', () => {
    setup.mode = 'siigo'
    expect(getIntegrationPolicy('siigo')?.version).toBe('1.1')
    const html = render()
    expect(html).toContain('role="dialog"')
    expect(html).toContain('Integración SIIGO')
    expect(html).toContain('ARTÍCULO 1. IDENTIFICACIÓN DEL PRESTADOR')
    expect(html).not.toContain('ARTÍCULO 1. IDENTIFICACIÓN Y NATURALEZA DEL SERVICIO')
    expect(html).not.toContain('Contenido de la aplicación')
  })

  it('espera a confirmar la integración antes de presentar el documento', () => {
    setup.checking = true
    const html = render()
    expect(html).toContain('Consultando la integración')
    expect(html).not.toContain('role="dialog"')
    expect(html).not.toContain('Contenido de la aplicación')
  })
})
