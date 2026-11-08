import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from './apiClient'
import { companyQueryKey, setActiveCompanyId, setCachedQuery } from './queryCache'
import { fetchProductsImportCatalogs, saveImportedProducts } from './productsImportService'
import { DEFAULT_PRODUCT_IVA_ID } from '../utils/productTaxes'
import type { ProductImportRow } from '../utils/productsExcel'

vi.mock('./apiClient', () => ({ apiClient: { get: vi.fn(), post: vi.fn() }, getApiErrorMessage: (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback }))
function row(sku: string): ProductImportRow {
  return { row: Number(sku) + 1, sku, name: `Producto ${sku}`, errors: [], status: 'ready', payload: { sku, name: `Producto ${sku}`, kind: 'product', unit: '94', categoryId: 'category', description: 'Descripción', taxIds: [], priceIncludesIva: true, priceLists: [{ position: 1, name: 'General', price: 1250.5, enabled: true }, { position: 2, name: 'Mayorista', price: 1000.25, enabled: true }] } }
}
describe('guardado masivo de productos', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    setActiveCompanyId(null)
    setActiveCompanyId('company-a')
    vi.mocked(apiClient.get).mockResolvedValue({ data: { items: [], total: 0 } })
    vi.mocked(apiClient.post).mockImplementation(async (url, payload) => ({ data: url === '/products' ? { success: true, product: { ...(payload as object), id: 'saved' } } : { success: true, tax: { ...(payload as object), id: 'iva19' } } }))
  })
  it('envía todos los datos al endpoint de productos e invalida el catálogo', async () => {
    const input = row('1')
    const progress = vi.fn()
    const result = await saveImportedProducts([input], progress)
    expect(apiClient.post).toHaveBeenCalledExactlyOnceWith('/products', input.payload)
    expect(result[0].status).toBe('saved')
    expect(progress).toHaveBeenCalledOnce()
    expect(input.status).toBe('ready')
    const { peekCachedQuery } = await import('./queryCache')
    expect(peekCachedQuery(companyQueryKey(['products', 'list']))).toBeUndefined()
  })
  it('comprueba duplicados en el servidor aunque la caché diga que no hay productos', async () => {
    setCachedQuery(companyQueryKey(['products', 'list']), { items: [], total: 0 })
    vi.mocked(apiClient.get).mockResolvedValue({ data: { items: [{ sku: '1' }], total: 1 } })
    expect((await saveImportedProducts([row('1')], vi.fn()))[0].status).toBe('duplicate')
    expect(apiClient.get).toHaveBeenCalledExactlyOnceWith('/products')
    expect(apiClient.post).not.toHaveBeenCalled()
  })
  it('bloquea toda la carga si alguna fila tiene errores', async () => {
    await expect(saveImportedProducts([row('1'), { ...row('2'), status: 'invalid', errors: ['Falta precio'] }], vi.fn())).rejects.toThrow('Corrige')
    expect(apiClient.post).not.toHaveBeenCalled()
    expect(apiClient.get).not.toHaveBeenCalled()
  })
  it('continúa ante fallos y reintenta únicamente los productos no guardados', async () => {
    vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('Sin conexión'))
    const first = await saveImportedProducts([row('1'), row('2')], vi.fn())
    expect(first.map(item => item.status)).toEqual(['failed', 'saved'])
    vi.mocked(apiClient.post).mockClear()
    const second = await saveImportedProducts(first, vi.fn())
    expect(apiClient.post).toHaveBeenCalledExactlyOnceWith('/products', first[0].payload)
    expect(second.map(item => item.status)).toEqual(['saved', 'saved'])
  })
  it('comprueba respuestas perdidas antes de reenviar el mismo SKU', async () => {
    vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('Timeout'))
    const first = await saveImportedProducts([row('1')], vi.fn())
    vi.mocked(apiClient.get).mockResolvedValue({ data: { items: [{ sku: '1' }], total: 1 } })
    expect((await saveImportedProducts(first, vi.fn()))[0].status).toBe('duplicate')
    expect(apiClient.post).toHaveBeenCalledTimes(1)
  })
  it('materializa una sola vez el IVA predeterminado y nunca envía su ID temporal al backend', async () => {
    const rows = Array.from({ length: 5 }, (_, i) => row(String(i + 1)))
    rows.forEach(item => { item.payload!.taxIds = [DEFAULT_PRODUCT_IVA_ID] })
    const result = await saveImportedProducts(rows, vi.fn())
    expect(result.every(item => item.status === 'saved')).toBe(true)
    const writes = vi.mocked(apiClient.post).mock.calls
    expect(writes.filter(([url]) => url === '/integrations/jarvis/taxes')).toHaveLength(1)
    expect(writes.filter(([url]) => url === '/products')).toHaveLength(5)
    for (const [, payload] of writes.filter(([url]) => url === '/products')) expect(payload).toMatchObject({ taxIds: ['iva19'] })
    expect(rows[0].payload?.taxIds).toEqual([DEFAULT_PRODUCT_IVA_ID])
  })
  it('limita a tres las peticiones simultáneas', async () => {
    let active = 0
    let peak = 0
    vi.mocked(apiClient.post).mockImplementation(async () => {
      active++
      peak = Math.max(peak, active)
      await new Promise(resolve => setTimeout(resolve, 0))
      active--
      return { data: { success: true, product: { id: 'saved' } } }
    })
    const progress = vi.fn()
    await saveImportedProducts(Array.from({ length: 8 }, (_, i) => row(String(i + 1))), progress)
    expect(peak).toBe(3)
    expect(progress).toHaveBeenCalledTimes(8)
  })
  it('no marca como guardado lo que el servidor no confirmó', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { success: false } })
    expect((await saveImportedProducts([row('1')], vi.fn()))[0].status).toBe('failed')
  })
  it('detiene nuevos envíos si cambia la empresa activa', async () => {
    vi.mocked(apiClient.post).mockImplementation(async () => {
      setActiveCompanyId('company-b')
      return { data: { success: true, product: { id: 'saved' } } }
    })
    const result = await saveImportedProducts([row('1'), row('2'), row('3')], vi.fn())
    expect(apiClient.post).toHaveBeenCalledTimes(1)
    expect(result.map(item => item.status)).toEqual(['saved', 'failed', 'failed'])
  })
  it('no crea impuestos ni productos en otra empresa si cambia mientras consulta el IVA predeterminado', async () => {
    vi.mocked(apiClient.get).mockImplementation(async url => {
      if (url === '/integrations/jarvis/taxes') setActiveCompanyId('company-b')
      return { data: { items: [], total: 0 } }
    })
    const input = row('1')
    input.payload!.taxIds = [DEFAULT_PRODUCT_IVA_ID]
    expect((await saveImportedProducts([input], vi.fn()))[0].status).toBe('failed')
    expect(apiClient.post).not.toHaveBeenCalled()
  })
  it('consulta los catálogos de Jarvis y conserva la unidad predeterminada 94', async () => {
    const catalogs = await fetchProductsImportCatalogs()
    expect(catalogs).toEqual({ units: [{ code: '94', name: 'Unidad' }], categories: [], taxes: [] })
    expect(apiClient.get).toHaveBeenCalledWith('/products/unit-measures')
    expect(apiClient.get).toHaveBeenCalledWith('/products/categories')
    expect(apiClient.get).toHaveBeenCalledWith('/integrations/jarvis/taxes')
  })
})
