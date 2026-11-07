import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { clearRegistrationLink, readRegistrationLink, rememberRegistrationLink } from './registrationLink'

beforeEach(() => {
  const values = new Map<string, string>()
  vi.stubGlobal('sessionStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) })
})
afterEach(() => vi.unstubAllGlobals())
it('conserva el enlace al quitarlo de la URL y lo elimina al completar el registro', () => {
  expect(readRegistrationLink()).toBe('')
  rememberRegistrationLink('opaque-token')
  expect(readRegistrationLink()).toBe('opaque-token')
  clearRegistrationLink()
  expect(readRegistrationLink()).toBe('')
})
it('no interrumpe el registro si el navegador bloquea almacenamiento', () => {
  vi.stubGlobal('sessionStorage', { getItem: () => { throw Error() }, setItem: () => { throw Error() }, removeItem: () => { throw Error() } })
  expect(readRegistrationLink()).toBe('')
  expect(() => rememberRegistrationLink('token')).not.toThrow()
  expect(() => clearRegistrationLink()).not.toThrow()
})
