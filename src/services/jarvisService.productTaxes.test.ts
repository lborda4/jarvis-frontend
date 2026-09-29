import { beforeEach, describe, expect, it, vi } from 'vitest'
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('./apiClient', () => ({ apiClient: api }))
vi.mock('./queryCache', () => ({ companyQueryKey: (parts: string[]) => `company:${parts.join(':')}`, invalidateQueryCache: vi.fn(), cachedQuery: vi.fn(), QUERY_STALE_MS: {} }))
import { ensureDefaultProductIva } from './jarvisService'

const tax = { id: 'saved-tax-id', category: 'IMPUESTO', name: 'IVA', tax_type: 'IVA', rate: 19, is_active: true }
describe('saving the product default IVA', () => {
  beforeEach(() => vi.clearAllMocks())
  it('returns the real ID of an existing active tax', async () => {
    api.get.mockResolvedValue({ data: { items: [tax] } })
    expect(await ensureDefaultProductIva()).toEqual(tax)
    expect(api.post).not.toHaveBeenCalled()
  })
  it('creates the missing tax once for simultaneous requests', async () => {
    api.get.mockResolvedValue({ data: { items: [] } })
    api.post.mockResolvedValue({ data: { tax } })
    const results = await Promise.all([ensureDefaultProductIva(), ensureDefaultProductIva()])
    expect(results).toEqual([tax, tax])
    expect(api.post).toHaveBeenCalledTimes(1)
    expect(api.post).toHaveBeenCalledWith('/integrations/jarvis/taxes', { category: 'IMPUESTO', name: 'IVA', tax_type: 'IVA', rate: 19 })
  })
  it('allows retry after a failure without manufacturing an ID', async () => {
    api.get.mockRejectedValueOnce(new Error('Network')).mockResolvedValue({ data: { items: [tax] } })
    await expect(ensureDefaultProductIva()).rejects.toThrow('Network')
    expect(await ensureDefaultProductIva()).toEqual(tax)
  })
})
