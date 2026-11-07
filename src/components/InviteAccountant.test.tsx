import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, expect, it, vi } from 'vitest'
import InviteAccountant from './InviteAccountant'
import { isAuthRequestUrl } from '../constants/authEndpoints'
import { inviteAccountant } from '../services/authService'

const mocks = vi.hoisted(() => ({ useAuth: vi.fn(), post: vi.fn() }))
vi.mock('../context/AuthContext', () => ({ useAuth: mocks.useAuth }))
vi.mock('../services/apiClient', () => ({ apiClient: { post: mocks.post }, getApiErrorMessage: () => 'No se pudo enviar' }))

beforeEach(() => {
  vi.clearAllMocks()
  mocks.useAuth.mockReturnValue({ user: { company: { id: 'company-1', name: 'Empresa & socios' } } })
})

it('muestra la invitación para la empresa activa y explica el acceso adicional', () => {
  const html = renderToStaticMarkup(<InviteAccountant />)
  expect(html).toContain('Invitar al contador')
  expect(html).toContain('Empresa &amp; socios')
  expect(html).toContain('la persona a cargo conservará el suyo')
  expect(html).toContain('aria-expanded="false"')
})
it('no ofrece invitaciones cuando no hay empresa seleccionada', () => {
  mocks.useAuth.mockReturnValue({ user: { company: null } })
  expect(renderToStaticMarkup(<InviteAccountant />)).toBe('')
})
it('envía solo el destinatario por un endpoint que requiere la sesión actual', async () => {
  const result = { status: 'SENT', message: 'Enviado' }
  mocks.post.mockResolvedValue({ data: result })
  await expect(inviteAccountant('contador@example.com')).resolves.toEqual(result)
  expect(mocks.post).toHaveBeenCalledWith('/auth/company/invite-accountant', { email: 'contador@example.com' })
  expect(isAuthRequestUrl('/auth/company/invite-accountant')).toBe(false)
})
