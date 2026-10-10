import { beforeEach, describe, expect, it, vi } from 'vitest'
const api = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }))
vi.mock('./apiClient', () => ({ apiClient: api }))
import { fetchSkuNumbering, saveSkuNumbering } from './productService'
import { invalidateQueryCache, setActiveCompanyId } from './queryCache'

describe('numeración automática de SKU', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    localStorage.clear()
    invalidateQueryCache()
    setActiveCompanyId('company-1')
  })

  it('guarda la numeración en el backend y localmente', async () => {
    const numbering = {
      product: { prefix: 'PROD', nextNumber: 8, digits: 4 },
      service: { prefix: 'SERV', nextNumber: 2, digits: 4 },
    }
    api.put.mockResolvedValue({ data: numbering })
    await expect(saveSkuNumbering(numbering)).resolves.toEqual(numbering)
    expect(api.put).toHaveBeenCalledWith('/products/sku-numbering', numbering)
    api.get.mockRejectedValue(new Error('sin endpoint'))
    await expect(fetchSkuNumbering()).resolves.toEqual(numbering)
  })
})
