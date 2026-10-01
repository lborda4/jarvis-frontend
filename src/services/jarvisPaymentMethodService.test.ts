import { beforeEach, describe, expect, it, vi } from 'vitest'
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }))
vi.mock('./apiClient', () => ({ apiClient: api }))
import { deleteJarvisPaymentMethod, fetchJarvisPaymentMethods, resolveJarvisPaymentMethodId, saveJarvisPaymentMethod } from './jarvisPaymentMethodService'
import { invalidateQueryCache, setActiveCompanyId } from './queryCache'
const method = { id: 'own-id', name: 'Caja principal', nextpymeMethodId: 10, nextpymeMethodName: 'Efectivo' }
describe('formas de pago Jarvis', () => {
  beforeEach(() => { vi.resetAllMocks(); invalidateQueryCache(); setActiveCompanyId('company-1') })
  it('usa el identificador maestro, no el UUID ni el nombre personalizado', () => {
    expect(resolveJarvisPaymentMethodId([method], method.id)).toBe(10)
    expect(() => resolveJarvisPaymentMethodId([method], '10')).toThrow('Selecciona')
    expect(resolveJarvisPaymentMethodId([method, { ...method, id: 'other', name: 'Caja secundaria' }], 'other')).toBe(10)
  })
  it('cachea el listado y no comparte datos entre empresas', async () => {
    api.get.mockResolvedValue({ data: { items: [method], total: 1 } })
    await fetchJarvisPaymentMethods(); await fetchJarvisPaymentMethods()
    expect(api.get).toHaveBeenCalledTimes(1)
    setActiveCompanyId('company-2')
    await fetchJarvisPaymentMethods()
    expect(api.get).toHaveBeenCalledTimes(2)
  })
  it.each(['create', 'update', 'delete'])('invalida el catálogo al %s', async operation => {
    api.get.mockResolvedValue({ data: { items: [method], total: 1 } })
    api.post.mockResolvedValue({ data: { paymentMethod: method } })
    api.patch.mockResolvedValue({ data: { paymentMethod: method } })
    api.delete.mockResolvedValue({})
    await fetchJarvisPaymentMethods()
    if (operation === 'delete') await deleteJarvisPaymentMethod(method.id)
    else await saveJarvisPaymentMethod(method, operation === 'update' ? method.id : undefined)
    await fetchJarvisPaymentMethods()
    expect(api.get).toHaveBeenCalledTimes(2)
  })
})
