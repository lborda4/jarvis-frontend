import { expect, it, vi } from 'vitest'
import { openAdvisorDemo } from './advisorService'
import { apiClient } from './apiClient'
import { extractAuthSession, extractAuthUser } from '../utils/authTokens'

vi.mock('./apiClient', () => ({ apiClient: { post: vi.fn() } }))
it('solicita acceso al tenant compartido del servidor y conserva la marca demo al procesar la sesión', async () => {
  const company = { id: 'shared-company', name: 'Empresa demo Jarvis', nit: '900000000', isDemo: true, jarvisModules: ['BILLING', 'PAYROLL'] }
  vi.mocked(apiClient.post).mockResolvedValue({ data: { company } })
  await expect(openAdvisorDemo()).resolves.toEqual({ company })
  expect(apiClient.post).toHaveBeenCalledWith('/advisor/demo/access')
  const user = { id: 'advisor', name: 'Comercial', email: 'advisor@example.test', role: 'advisor', company }
  expect(extractAuthUser({ user })?.company).toEqual(company)
  const session = extractAuthSession({ accessToken: 'access', refreshToken: 'refresh', user, companies: [company, { id: 'real', name: 'Empresa real', nit: '123' }] })
  expect(session?.user?.company?.isDemo).toBe(true)
  expect(session?.companies).toEqual([company, { id: 'real', name: 'Empresa real', nit: '123' }])
})
