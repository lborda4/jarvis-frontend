import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { apiClient } from './apiClient'
import { fetchJarvisSubscriptionStatus } from './jarvisService'
import { companyQueryKey, invalidateQueryCache, isCachedQueryFresh, peekCachedQuery, setActiveCompanyId, setCachedQuery } from './queryCache'

vi.mock('./apiClient', () => ({ apiClient: { get: vi.fn() } }))
const subscription = { status: 'ACTIVE', startedAt: null, documentLimit: 100, documentsUsed: 5, remaining: 95, includedDocumentTypes: [], plan: null }
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-12T00:00:00Z'))
  vi.mocked(apiClient.get).mockReset().mockResolvedValue({ data: subscription })
  invalidateQueryCache(); setActiveCompanyId('company-a')
})
afterEach(() => { vi.useRealTimers() })

it('consulta solo el cupo y comparte solicitudes concurrentes incluso después de emisiones', async () => {
  await Promise.all([fetchJarvisSubscriptionStatus({ force: true }), fetchJarvisSubscriptionStatus({ force: true })])
  await fetchJarvisSubscriptionStatus()
  expect(apiClient.get).toHaveBeenCalledExactlyOnceWith('/integrations/jarvis/subscription/status')
  await fetchJarvisSubscriptionStatus({ force: true })
  expect(apiClient.get).toHaveBeenCalledTimes(2)
})

it('reutiliza el cupo por 24 horas al volver a la pestaña y lo refresca al vencer', async () => {
  await fetchJarvisSubscriptionStatus()
  await vi.advanceTimersByTimeAsync(24 * 60 * 60_000 - 1000)
  await fetchJarvisSubscriptionStatus()
  expect(apiClient.get).toHaveBeenCalledTimes(1)
  await vi.advanceTimersByTimeAsync(1000)
  await fetchJarvisSubscriptionStatus()
  expect(apiClient.get).toHaveBeenCalledTimes(2)
})

it('actualiza el cupo del estado guardado sin extender la vigencia de la configuración', async () => {
  const key = companyQueryKey(['jarvis', 'credentials-status'])
  setCachedQuery(key, { configured: true, business_name: 'Empresa', subscription: { documentsUsed: 0 } })
  await vi.advanceTimersByTimeAsync(24 * 60 * 60_000 - 1000)
  await fetchJarvisSubscriptionStatus()
  expect(peekCachedQuery(key)).toEqual({ configured: true, business_name: 'Empresa', subscription })
  await vi.advanceTimersByTimeAsync(1000)
  expect(isCachedQueryFresh(key, 24 * 60 * 60_000)).toBe(false)
})

it('separa empresas y descarta la actualización tardía del estado de otra empresa', async () => {
  let complete!: (value: unknown) => void
  vi.mocked(apiClient.get).mockImplementationOnce(() => new Promise(resolve => { complete = resolve }) as never)
  const old = fetchJarvisSubscriptionStatus()
  await vi.advanceTimersByTimeAsync(0)
  setActiveCompanyId('company-b')
  const key = companyQueryKey(['jarvis', 'credentials-status'])
  setCachedQuery(key, { configured: true, subscription: { documentsUsed: 42 } })
  complete({ data: subscription }); await old
  expect(peekCachedQuery(key)).toEqual({ configured: true, subscription: { documentsUsed: 42 } })
  await fetchJarvisSubscriptionStatus()
  expect(apiClient.get).toHaveBeenCalledTimes(2)
})

it('no conserva fallos como respuestas exitosas y permite reintentar sin borrar la configuración', async () => {
  vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('offline'))
  await expect(fetchJarvisSubscriptionStatus()).rejects.toThrow('offline')
  await expect(fetchJarvisSubscriptionStatus()).resolves.toEqual(subscription)
  expect(apiClient.get).toHaveBeenCalledTimes(2)
})
