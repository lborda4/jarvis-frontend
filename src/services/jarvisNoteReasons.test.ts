import { beforeEach, expect, it, vi } from 'vitest'
import { apiClient } from './apiClient'
import { fetchJarvisNoteReasons, fetchJarvisTypeRejections } from './jarvisService'
import { invalidateQueryCache, setActiveCompanyId } from './queryCache'
vi.mock('./apiClient', () => ({ apiClient: { get: vi.fn() } }))
beforeEach(() => { vi.clearAllMocks(); invalidateQueryCache(); setActiveCompanyId('company-1') })

it('usa motivos de credito para notas credito y ajuste y separa la cache de debito', async () => {
  vi.mocked(apiClient.get).mockImplementation(async url => ({ data: [{ id: 1, code: '1', name: String(url) }] }))
  const credit = await fetchJarvisNoteReasons('credit')
  const debit = await fetchJarvisNoteReasons('debit')
  expect(credit).not.toEqual(debit)
  await fetchJarvisNoteReasons('credit')
  expect(apiClient.get).toHaveBeenCalledTimes(2)
  expect(apiClient.get).toHaveBeenCalledWith('/integrations/jarvis/catalogs/credit-note-discrepancy-responses')
  expect(apiClient.get).toHaveBeenCalledWith('/integrations/jarvis/catalogs/debit-note-discrepancy-responses')
})

it('mantiene type_rejections para los reclamos RADIAN', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({ data: [] })
  await fetchJarvisTypeRejections()
  expect(apiClient.get).toHaveBeenCalledWith('/integrations/jarvis/catalogs/type-rejections')
})
