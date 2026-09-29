import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from './apiClient'
import { companyQueryKey, invalidateQueryCache, setActiveCompanyId, setCachedQuery } from './queryCache'

vi.mock('./authStorage', () => ({
  getAccessToken: () => 'test-token', getRefreshToken: () => null,
  clearTokens: vi.fn(), notifySessionExpired: vi.fn(), setTokens: vi.fn(),
}))

describe('peticiones SIIGO por empresa activa', () => {
  const adapter = vi.fn(async config => ({ data: {}, status: 200, statusText: 'OK', headers: {}, config }))
  beforeEach(() => { invalidateQueryCache(); setActiveCompanyId('company-1'); adapter.mockClear() })
  function providers(values: string[]) {
    setCachedQuery(companyQueryKey(['integrations', 'providers']), { providers: values })
  }
  it.each(['credentials/status', 'accounts', 'taxes', 'products', 'catalogs/sync', 'purchases'])('Jarvis no envía %s', async endpoint => {
    providers(['JARVIS'])
    await expect(apiClient.get('/integrations/siigo/' + endpoint, { adapter })).rejects.toMatchObject({ code: 'ERR_CANCELED' })
    expect(adapter).not.toHaveBeenCalled()
  })
  it('espera conocer la integración antes de permitir consultas SIIGO', async () => {
    await expect(apiClient.get('/integrations/siigo/accounts', { adapter })).rejects.toMatchObject({ code: 'ERR_CANCELED' })
    expect(adapter).not.toHaveBeenCalled()
  })
  it.each([['SIIGO'], ['JARVIS', 'SIIGO']])('permite SIIGO cuando está activo (%s)', async (...values) => {
    providers(values)
    await apiClient.get('/integrations/siigo/accounts', { adapter })
    expect(adapter).toHaveBeenCalledTimes(1)
  })
  it('no reutiliza permisos al cambiar desde SIIGO a Jarvis', async () => {
    providers(['SIIGO'])
    setActiveCompanyId('jarvis-company')
    providers(['JARVIS'])
    await expect(apiClient.post('/integrations/siigo/catalogs/sync', {}, { adapter })).rejects.toMatchObject({ code: 'ERR_CANCELED' })
    expect(adapter).not.toHaveBeenCalled()
  })
  it('permite consultar Jarvis y descubrir las integraciones', async () => {
    providers(['JARVIS'])
    await apiClient.get('/integrations/jarvis/credentials/status', { adapter })
    await apiClient.get('/integrations/providers', { adapter })
    expect(adapter).toHaveBeenCalledTimes(2)
  })
})
