import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ElectronicDocumentListResponse } from '../types/electronicDocument'
import { apiClient } from './apiClient'
import {
  fetchElectronicDocuments,
  fetchImportedDocuments,
  invalidateElectronicDocumentsCache,
  peekElectronicDocuments,
} from './electronicDocumentService'
import { invalidateQueryCache, setActiveCompanyId } from './queryCache'

vi.mock('./apiClient', () => ({ apiClient: { get: vi.fn() } }))

describe('actualizar documentos después de la clasificación de IA', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    invalidateQueryCache()
    setActiveCompanyId('company-test')
  })

  it('descarta el listado sin cuentas y vuelve a consultar todas las páginas cacheadas', async () => {
    const empty = { items: [] } as unknown as ElectronicDocumentListResponse
    const classified = {
      items: [{ id: 'EFPE9690', items: [{ accountMapping: { code: '51953001' } }] }],
    } as unknown as ElectronicDocumentListResponse
    vi.mocked(apiClient.get).mockResolvedValue({ data: empty })
    await fetchElectronicDocuments({ page: 1 })
    await fetchElectronicDocuments({ page: 2 })
    vi.mocked(apiClient.get).mockResolvedValue({ data: classified })
    expect(await fetchElectronicDocuments({ page: 1 })).toBe(empty)

    invalidateElectronicDocumentsCache()

    expect(peekElectronicDocuments({ page: 1 })).toBeUndefined()
    expect(peekElectronicDocuments({ page: 2 })).toBeUndefined()
    expect(await fetchElectronicDocuments({ page: 1 })).toBe(classified)
    expect(apiClient.get).toHaveBeenCalledTimes(3)
  })
})


describe('consultar el lote importado por IDs', () => {
  beforeEach(() => { vi.resetAllMocks(); invalidateQueryCache(); setActiveCompanyId('company-test') })
  it('consulta más de cien documentos en lotes y recupera IDs antiguos fuera de la primera página', async () => {
    const ids = Array.from({ length: 205 }, (_, index) => 'document-' + index)
    for (let offset = 0; offset < ids.length; offset += 100) {
      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: {
        items: [...ids.slice(offset, offset + 100).map((id) => ({ id })), { id: 'not-requested' }],
      } })
    }
    const result = await fetchImportedDocuments([...ids, ids[0], ' '], 'PURCHASE_INVOICE')
    expect(result.map(({ id }) => id)).toEqual(ids)
    expect(apiClient.get).toHaveBeenCalledTimes(3)
    expect(vi.mocked(apiClient.get).mock.calls.map(([, config]) => config?.params.documentIds.split(',').length)).toEqual([100, 100, 5])
    expect(apiClient.get).toHaveBeenLastCalledWith('/electronic-documents', expect.objectContaining({
      params: expect.objectContaining({ documentIds: ids.slice(200).join(','), page: 1, limit: 100 }),
    }))
  })
  it('consulta al servidor en cada sondeo, aunque exista caché para el lote', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { items: [{ id: 'old-document', aiConfidence: null }] } })
      .mockResolvedValueOnce({ data: { items: [{ id: 'old-document', aiConfidence: 85 }] } })
    expect((await fetchImportedDocuments(['old-document'], 'PURCHASE_INVOICE'))[0].aiConfidence).toBeNull()
    expect((await fetchImportedDocuments(['old-document'], 'PURCHASE_INVOICE'))[0].aiConfidence).toBe(85)
    expect(apiClient.get).toHaveBeenCalledTimes(2)
  })
})
