import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from './apiClient'
import { fetchAdminBoldCredentials, saveAdminBoldCredentials, fetchBoldBindedTerminals, saveBoldCashRegister } from './adminService'

vi.mock('./apiClient', () => ({ apiClient: { get: vi.fn(), patch: vi.fn(), post: vi.fn() } }))

describe('credenciales Bold por empresa', () => {
  beforeEach(() => vi.resetAllMocks())
  it('consulta el estado de las llaves de la empresa seleccionada', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { identityKey: 'identity', hasSecretKey: true } })
    expect(await fetchAdminBoldCredentials('company-1')).toEqual({ identityKey: 'identity', hasSecretKey: true })
    expect(apiClient.get).toHaveBeenCalledWith('/admin/companies/company-1/bold/credentials')
  })
  it('envía las dos llaves a la integración de la empresa seleccionada', async () => {
    vi.mocked(apiClient.patch).mockResolvedValue({ data: { identityKey: 'identity', hasSecretKey: true } })
    await saveAdminBoldCredentials('company-2', { identityKey: 'identity', secretKey: 'new-secret' })
    expect(apiClient.patch).toHaveBeenCalledWith('/admin/companies/company-2/bold/credentials', { identityKey: 'identity', secretKey: 'new-secret' })
  })
  it('permite conservar la llave secreta sin devolverla ni reenviarla', async () => {
    vi.mocked(apiClient.patch).mockResolvedValue({ data: { identityKey: 'updated', hasSecretKey: true } })
    await saveAdminBoldCredentials('company-1', { identityKey: 'updated' })
    expect(apiClient.patch).toHaveBeenCalledWith('/admin/companies/company-1/bold/credentials', { identityKey: 'updated' })
  })
})

describe('cajas y datáfonos Bold', () => {
  beforeEach(() => vi.resetAllMocks())
  it('consulta por empresa sin enviar llaves desde el navegador', async () => {
    const response = { payload: { available_terminals: [] }, errors: [] }
    vi.mocked(apiClient.get).mockResolvedValue({ data: response })
    expect(await fetchBoldBindedTerminals('company-1')).toEqual(response)
    expect(apiClient.get).toHaveBeenCalledWith('/bold/payments/binded-terminals', { params: { companyId: 'company-1' } })
  })
  it('guarda el serial seleccionado junto con la caja y empresa', async () => {
    const request = { companyId: 'company-1', cashRegisterName: 'Principal', boldTerminalId: 'serial-123' }
    vi.mocked(apiClient.post).mockResolvedValue({ data: { item: { id: 'mapping-1', ...request } } })
    await saveBoldCashRegister(request)
    expect(apiClient.post).toHaveBeenCalledWith('/bold/cash-registers', request)
  })
})
