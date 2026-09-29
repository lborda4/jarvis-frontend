import { beforeEach, expect, it, vi } from 'vitest'
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('./apiClient', () => ({ apiClient: api }))
import { createJarvisInvoice, fetchJarvisSalesInvoices, fetchJarvisSupportInvoices, jarvisHistoryQueryKey } from './jarvisService'
import { invalidateQueryCache, peekCachedQuery, setActiveCompanyId } from './queryCache'

beforeEach(() => {
  invalidateQueryCache(); setActiveCompanyId('company-a'); vi.clearAllMocks()
  api.get.mockResolvedValue({ data: { items: [], total: 0, page: 1, pageSize: 20 } })
  api.post.mockResolvedValue({ data: { success: true } })
})
it('separates document kinds, filters and pages, and reuses repeated visits', async () => {
  await fetchJarvisSalesInvoices({})
  await fetchJarvisSalesInvoices({ search: '', page: 1 })
  expect(api.get).toHaveBeenCalledTimes(1)
  await fetchJarvisSupportInvoices({})
  await fetchJarvisSalesInvoices({ page: 2 })
  await fetchJarvisSalesInvoices({ search: 'CUFE' })
  expect(api.get).toHaveBeenCalledTimes(4)
})
it('refresh bypasses fresh cached data', async () => {
  await fetchJarvisSalesInvoices({})
  await fetchJarvisSalesInvoices({}, { force: true })
  expect(api.get).toHaveBeenCalledTimes(2)
})
it('sending a sale invalidates all its cached pages but preserves support documents', async () => {
  await fetchJarvisSalesInvoices({ page: 2 })
  await fetchJarvisSupportInvoices({})
  await createJarvisInvoice({} as never)
  expect(peekCachedQuery(jarvisHistoryQueryKey(false, { page: 2 }))).toBeUndefined()
  expect(peekCachedQuery(jarvisHistoryQueryKey(true))).toBeDefined()
})
