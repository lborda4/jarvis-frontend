import { beforeEach, expect, it, vi } from 'vitest'
import { apiClient } from './apiClient'
import { convertUserToAdvisor, lookupAdvisorConversionUser } from './adminAdvisorsService'

vi.mock('./apiClient', () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }))
beforeEach(() => vi.clearAllMocks())

it('busca una cuenta existente por correo sin crear ni convertir usuarios', async () => {
  const user = { id: 'existing', name: 'Usuario', email: 'user@example.test', canConvert: true }
  vi.mocked(apiClient.get).mockResolvedValue({ data: { user } })
  await expect(lookupAdvisorConversionUser(user.email)).resolves.toEqual({ user })
  expect(apiClient.get).toHaveBeenCalledWith('/admin/advisors/existing-user', { params: { email: user.email } })
  expect(apiClient.post).not.toHaveBeenCalled()
})

it('convierte el id confirmado por el administrador sin reenviar contraseña ni comisiones', async () => {
  const result = { advisor: { id: 'advisor', registered: true }, changed: true }
  vi.mocked(apiClient.post).mockResolvedValue({ data: result })
  await expect(convertUserToAdvisor('existing')).resolves.toEqual(result)
  expect(apiClient.post).toHaveBeenCalledWith('/admin/advisors/existing-users/existing/convert')
})

it('propaga los rechazos del servidor para mostrarlos sin convertir el usuario localmente', async () => {
  const error = new Error('La cuenta está inactiva')
  vi.mocked(apiClient.post).mockRejectedValue(error)
  await expect(convertUserToAdvisor('existing')).rejects.toBe(error)
})
