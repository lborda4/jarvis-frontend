import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { getIntegrationPolicy } from '../constants/integrationPolicies'
import { isAuthRequestUrl } from '../constants/authEndpoints'
import { clearRegistrationPolicyAcceptance, readRegistrationPolicyAcceptance, registrationAcceptedPolicy, saveRegistrationPolicyAcceptance } from './registrationPolicyAcceptance'

beforeEach(() => {
  const values = new Map<string, string>()
  vi.stubGlobal('sessionStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) })
})
afterEach(() => vi.unstubAllGlobals())

it('conserva la aceptación al volver al registro para el mismo correo y empresa', () => {
  const policy = getIntegrationPolicy('jarvis')!
  saveRegistrationPolicyAcceptance('company-uuid', 'PERSONA@example.com ', policy)
  expect(registrationAcceptedPolicy(readRegistrationPolicyAcceptance(), 'company-uuid', 'persona@example.com')).toEqual(policy)
})
it('no reutiliza la aceptación para otra cuenta, empresa o versión', () => {
  const policy = getIntegrationPolicy('jarvis')!
  const accepted = saveRegistrationPolicyAcceptance('123', 'user@example.com', policy)
  expect(registrationAcceptedPolicy(accepted, '456', 'user@example.com')).toBeUndefined()
  expect(registrationAcceptedPolicy(accepted, '123', 'other@example.com')).toBeUndefined()
  expect(registrationAcceptedPolicy({ ...accepted, version: 'old' }, '123', 'user@example.com')).toBeUndefined()
  expect(registrationAcceptedPolicy({ ...accepted, policyId: 'unknown' }, '123', 'user@example.com')).toBeUndefined()
})
it('limpia la aceptación temporal después de crear la cuenta', () => {
  saveRegistrationPolicyAcceptance('123', 'user@example.com', getIntegrationPolicy('jarvis')!)
  clearRegistrationPolicyAcceptance()
  expect(readRegistrationPolicyAcceptance()).toBeNull()
})
it('funciona si el navegador bloquea el almacenamiento', () => {
  vi.stubGlobal('sessionStorage', { getItem: () => { throw new Error() }, setItem: () => { throw new Error() } })
  expect(readRegistrationPolicyAcceptance()).toBeNull()
  expect(saveRegistrationPolicyAcceptance('123', 'user@example.com', getIntegrationPolicy('jarvis')!).policyId).toContain('jarvis-terms')
})
it('la consulta de la política no requiere token ni intenta renovar la sesión ante un código inválido', () => {
  expect(isAuthRequestUrl('/auth/registration-policy')).toBe(true)
})
