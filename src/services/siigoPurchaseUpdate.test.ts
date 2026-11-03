import { beforeEach, describe, expect, it, vi } from 'vitest'
const api = vi.hoisted(() => ({ put: vi.fn(), post: vi.fn() }))
vi.mock('./apiClient', () => ({ apiClient: api, API_BASE_URL: '' }))
import { updateSiigoPurchase, refreshSiigoPurchase, resendSiigoPurchase } from './siigoService'
import { companyQueryKey, peekCachedQuery, setActiveCompanyId, setCachedQuery, invalidateQueryCache } from './queryCache'
import type { CreateSiigoPurchaseSendRequest } from '../types/siigo'

describe('Modificar una compra enviada', () => {
  beforeEach(() => { vi.resetAllMocks(); invalidateQueryCache(); setActiveCompanyId('company') })
  const request: CreateSiigoPurchaseSendRequest = {
    documentId: 'local-id', date: '2026-10-01', supplier: { identification: '9001' },
    provider_invoice: { prefix: 'FC', number: '10' },
    items: [{ code: '5101', quantity: 1, price: 100000, taxes: [{ id: 8 }] }],
    payments: [{ id: 1, value: 108000 }],
  }
  it('usa PUT del documento existente, mantiene INC y refresca el listado al confirmar', async () => {
    const key = companyQueryKey(['electronic-documents', 'list'])
    setCachedQuery(key, ['previous'])
    api.put.mockResolvedValue({ data: { success: true } })
    await updateSiigoPurchase({ ...request, draft: { savedAt: '2026-10-29' } })
    expect(api.put).toHaveBeenCalledWith('/integrations/siigo/purchases/local-id', expect.objectContaining({
      ...request, draft: { savedAt: '2026-10-29' },
    }))
    expect(api.post).not.toHaveBeenCalled()
    expect(peekCachedQuery(key)).toBeUndefined()
  })
  it('propaga el rechazo y conserva la caché con los datos confirmados', async () => {
    const key = companyQueryKey(['electronic-documents', 'list'])
    setCachedQuery(key, ['confirmed'])
    api.put.mockRejectedValue(new Error('Compra con pagos asociados'))
    await expect(updateSiigoPurchase({ ...request, draft: { savedAt: '2026-10-29' } })).rejects.toThrow('pagos asociados')
    expect(peekCachedQuery(key)).toEqual(['confirmed'])
    expect(api.post).not.toHaveBeenCalled()
  })
  it.each([true, false])('consulta el ID sin enviar una compra, existe=%s', async exists => {
    api.post.mockResolvedValue({ data: { exists, siigoPurchaseId: 'remote-id' } })
    expect(await refreshSiigoPurchase('local/id')).toEqual({ exists, siigoPurchaseId: 'remote-id' })
    expect(api.post).toHaveBeenCalledWith('/integrations/siigo/purchases/local%2Fid/refresh')
    expect(api.put).not.toHaveBeenCalled()
  })
  it('propaga fallas de consulta sin convertirlas en factura ausente', async () => {
    api.post.mockRejectedValue(new Error('SIIGO no disponible'))
    await expect(refreshSiigoPurchase('local-id')).rejects.toThrow('no disponible')
  })
  it('reenvía por el endpoint que verifica ausencia y limpia caché después del éxito', async () => {
    const key = companyQueryKey(['electronic-documents', 'list'])
    setCachedQuery(key, ['previous'])
    api.post.mockResolvedValue({ data: { success: true } })
    await resendSiigoPurchase({ ...request, draft: { savedAt: '2026-11-02' } })
    expect(api.post).toHaveBeenCalledWith('/integrations/siigo/purchases/local-id/resend', expect.objectContaining(request))
    expect(api.put).not.toHaveBeenCalled()
    expect(peekCachedQuery(key)).toBeUndefined()
  })
  it('conserva la caché confirmada si falla el reenvío', async () => {
    const key = companyQueryKey(['electronic-documents', 'list'])
    setCachedQuery(key, ['confirmed'])
    api.post.mockRejectedValue(new Error('Todavía existe'))
    await expect(resendSiigoPurchase({ ...request, draft: null })).rejects.toThrow('Todavía existe')
    expect(peekCachedQuery(key)).toEqual(['confirmed'])
  })
})
