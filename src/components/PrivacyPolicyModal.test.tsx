import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { expect, it } from 'vitest'
import IntegrationPolicyModal from './IntegrationPolicyModal'
import PrivacyPolicyLink from './PrivacyPolicyLink'
import PrivacyPolicyConsent from './PrivacyPolicyConsent'
import PrivacyPolicyPage from '../pages/PrivacyPolicyPage'
import { getIntegrationPolicy } from '../constants/integrationPolicies'

it('la consulta pública solo muestra cerrar, sin aceptar ni cerrar sesión', () => {
  const html = renderToStaticMarkup(<IntegrationPolicyModal policy={getIntegrationPolicy('jarvis')!} onClose={() => {}} />)
  expect(html).toContain('role="dialog"')
  expect(html).toContain('>Cerrar</button>')
  expect(html).not.toContain('He leído y acepto')
  expect(html).not.toContain('Cerrar sesión')
})
it('en el registro permite aceptar después de leer y volver sin aceptar', () => {
  const html = renderToStaticMarkup(<IntegrationPolicyModal policy={getIntegrationPolicy('siigo')!} onAccept={() => {}} onCancel={() => {}} />)
  expect(html).toContain('He leído y acepto')
  expect(html).toContain('Volver al registro')
  expect(html).toMatch(/<button[^>]*disabled=""[^>]*>He leído y acepto/)
  expect(html).not.toContain('Cerrar sesión')
})
it('los enlaces públicos tienen una ruta propia y abren un diálogo', () => {
  const html = renderToStaticMarkup(<MemoryRouter><PrivacyPolicyLink mode="siigo" /></MemoryRouter>)
  expect(html).toContain('/politica-de-tratamiento-de-datos?integracion=siigo')
  expect(html).toContain('aria-haspopup="dialog"')
  expect(html).not.toContain('target="_blank"')
})
it('la ruta directa es pública y solo permite leer el documento', () => {
  const html = renderToStaticMarkup(<MemoryRouter initialEntries={['/politica-de-tratamiento-de-datos']}><PrivacyPolicyPage /></MemoryRouter>)
  expect(html).toContain('role="dialog"')
  expect(html).toContain('>Cerrar</button>')
  expect(html).not.toContain('He leído y acepto')
})
it('después de aceptar el registro ofrece consultar la política aceptada', () => {
  const html = renderToStaticMarkup(<PrivacyPolicyConsent policy={getIntegrationPolicy('jarvis')!} acceptedPolicy={getIntegrationPolicy('jarvis')} onAccepted={() => {}} />)
  expect(html).toContain('Política aceptada · Consultar')
  expect(html).not.toContain('Leer política y aceptar')
})
