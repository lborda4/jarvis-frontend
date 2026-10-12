import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from './apiClient'
import { companyQueryKey, invalidateQueryCache, setActiveCompanyId, setCachedQuery } from './queryCache'

vi.mock('./authStorage', () => ({
  getAccessToken: () => 'test-token', getRefreshToken: () => null,
  clearTokens: vi.fn(), notifySessionExpired: vi.fn(), setTokens: vi.fn(),
}))

describe('peticiones Bold con integración Jarvis', () => {
  const adapter = vi.fn(async config => ({ data: {}, status: 200, statusText: 'OK', headers: {}, config }))
  beforeEach(() => { invalidateQueryCache(); setActiveCompanyId('company-1'); adapter.mockClear() })
  function providers(values: string[]) {
    setCachedQuery(companyQueryKey(['integrations', 'providers']), { providers: values })
  }

  it.each([
    '/bold/payments/binded-terminals',
    '/bold/cash-registers/company-1',
    '/integrations/bold/credentials',
    '/admin/companies/company-1/bold/credentials',
  ])('Jarvis no envía peticiones a %s', async endpoint => {
    providers(['JARVIS', 'BOLD'])
    await expect(apiClient.get(endpoint, { adapter })).rejects.toMatchObject({ code: 'ERR_CANCELED' })
    await expect(apiClient.post(endpoint, {}, { adapter })).rejects.toMatchObject({ code: 'ERR_CANCELED' })
    await expect(apiClient.patch(endpoint, {}, { adapter })).rejects.toMatchObject({ code: 'ERR_CANCELED' })
    expect(adapter).not.toHaveBeenCalled()
  })

  it.each([['SIIGO', 'BOLD'], ['BOLD'], ['JARVIS', 'SIIGO', 'BOLD']])('permite Bold fuera del modo Jarvis (%s)', async (...values) => {
    providers(values)
    await apiClient.get('/bold/payments/binded-terminals', { adapter })
    expect(adapter).toHaveBeenCalledTimes(1)
  })

  it('aplica la protección al cambiar de empresa a Jarvis', async () => {
    providers(['SIIGO', 'BOLD'])
    await apiClient.get('/bold/payments/binded-terminals', { adapter })
    adapter.mockClear()
    setActiveCompanyId('jarvis-company')
    providers(['JARVIS'])
    await expect(apiClient.get('/bold/payments/binded-terminals', { adapter })).rejects.toMatchObject({ code: 'ERR_CANCELED' })
    expect(adapter).not.toHaveBeenCalled()
  })

  it('permite las peticiones propias de Jarvis', async () => {
    providers(['JARVIS'])
    await apiClient.get('/integrations/jarvis/credentials/status', { adapter })
    await apiClient.get('/integrations/providers', { adapter })
    expect(adapter).toHaveBeenCalledTimes(2)
  })
})
