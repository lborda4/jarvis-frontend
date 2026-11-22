import { beforeEach, expect, it, vi } from 'vitest'
import { fetchAdvisorRegistration, register } from './authService'
import { apiClient } from './apiClient'
import { setTokens } from './authStorage'
import { isAuthRequestUrl } from '../constants/authEndpoints'

vi.mock('./apiClient', () => ({ apiClient: { post: vi.fn() } }))
vi.mock('./authStorage', () => ({ setTokens: vi.fn(), clearTokens: vi.fn(), getRefreshToken: vi.fn() }))
beforeEach(() => vi.clearAllMocks())
it('registra al asesor con el enlace de su correo y conserva una sesión sin empresa', async () => {
  vi.mocked(apiClient.post).mockResolvedValue({ data: { accessToken: 'access', refreshToken: 'refresh', user: { id: 'a', name: 'Laura', email: 'laura@example.com', role: 'advisor', company: null }, companies: [] } })
  const session = await register({ advisorRegistration: true, registrationToken: 'opaque-token', password: 'password123', acceptPrivacyPolicy: true })
  expect(apiClient.post).toHaveBeenCalledWith('/auth/advisor-registration', { registrationToken: 'opaque-token', password: 'password123', acceptPrivacyPolicy: true })
  expect(session.user?.role).toBe('advisor'); expect(session.user?.company).toBeNull(); expect(session.companies).toEqual([])
  expect(setTokens).toHaveBeenCalledWith({ accessToken: 'access', refreshToken: 'refresh' })
})
it('valida el enlace como petición pública sin crear una sesión ni consumir el registro', async () => {
  vi.mocked(apiClient.post).mockResolvedValue({ data: { name: 'Laura', email: 'laura@example.com' } })
  await expect(fetchAdvisorRegistration('opaque-token')).resolves.toEqual({ name: 'Laura', email: 'laura@example.com' })
  expect(apiClient.post).toHaveBeenCalledWith('/auth/advisor-registration/preview', { registrationToken: 'opaque-token' })
  expect(isAuthRequestUrl('/auth/advisor-registration/preview')).toBe(true)
  expect(isAuthRequestUrl('/auth/advisor-registration')).toBe(true)
  expect(setTokens).not.toHaveBeenCalled()
})
