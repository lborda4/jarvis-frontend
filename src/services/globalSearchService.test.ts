import { beforeEach, expect, it, vi } from 'vitest'
import { searchGlobally, availableSearchCategories, type SearchAccess } from './globalSearchService'
import { fetchProducts } from './productService'
import { fetchElectronicDocuments } from './electronicDocumentService'
import { fetchJarvisSalesInvoices, fetchJarvisTerceros, fetchJarvisSupportInvoices, fetchJarvisCreditNotes, fetchJarvisDebitNotes, fetchJarvisSupportCreditNotes } from './jarvisService'
import { setActiveCompanyId } from './queryCache'

vi.mock('./productService', () => ({ fetchProducts: vi.fn() }))
vi.mock('./electronicDocumentService', () => ({ fetchElectronicDocuments: vi.fn() }))
vi.mock('./jarvisService', () => ({ fetchJarvisSalesInvoices: vi.fn(), fetchJarvisTerceros: vi.fn(), fetchJarvisSupportInvoices: vi.fn(), fetchJarvisCreditNotes: vi.fn(), fetchJarvisDebitNotes: vi.fn(), fetchJarvisSupportCreditNotes: vi.fn() }))
const access: SearchAccess = { companyId: 'a', provider: 'JARVIS', sales: true, purchases: false, support: true, thirdParties: true, products: true }
beforeEach(() => {
  vi.resetAllMocks(); setActiveCompanyId('a')
  for (const fn of [fetchProducts, fetchElectronicDocuments, fetchJarvisTerceros, fetchJarvisSalesInvoices, fetchJarvisSupportInvoices, fetchJarvisCreditNotes, fetchJarvisDebitNotes, fetchJarvisSupportCreditNotes]) vi.mocked(fn).mockResolvedValue({ items: [], total: 0 } as never)
})

it('no consulta con texto vacío, un carácter o una empresa que ya no está activa', async () => {
  expect(await searchGlobally(' ', 'all', access)).toEqual([])
  expect(await searchGlobally('a', 'all', access)).toEqual([])
  expect(await searchGlobally('900', 'all', { ...access, companyId: 'b' })).toEqual([])
  expect(fetchProducts).not.toHaveBeenCalled(); expect(fetchJarvisSalesInvoices).not.toHaveBeenCalled()
})

it('busca solo en la categoría elegida y abre el producto por su código', async () => {
  vi.mocked(fetchProducts).mockResolvedValue({ items: [{ id: 'p', name: 'Servicio', sku: 'SERV 1' }], total: 1 } as never)
  const result = await searchGlobally(' Servicio ', 'products', access)
  expect(fetchProducts).toHaveBeenCalledWith('Servicio')
  expect(result).toEqual([{ category: 'products', total: 1, items: [{ id: 'p', title: 'Servicio', description: 'SERV 1', to: '/productos/listar?buscar=SERV+1' }] }])
  expect(fetchJarvisTerceros).not.toHaveBeenCalled(); expect(fetchElectronicDocuments).not.toHaveBeenCalled()
})

it('conserva resultados de otras categorías cuando una fuente falla', async () => {
  vi.mocked(fetchJarvisSalesInvoices).mockRejectedValue(new Error('Sin conexión'))
  vi.mocked(fetchJarvisTerceros).mockResolvedValue({ items: [{ id: 't', name: 'Cliente', document_type: 'NIT', document_number: '900123' }], total: 1 } as never)
  const results = await searchGlobally('900', 'all', access)
  expect(results.find(item => item.category === 'sales')).toMatchObject({ failed: true, items: [] })
  expect(results.find(item => item.category === 'thirdParties')?.items[0].to).toBe('/terceros?buscar=900123')
})

it('separa los proveedores y no llama módulos Jarvis para una empresa SIIGO', async () => {
  const siigo: SearchAccess = { ...access, provider: 'SIIGO', sales: false, purchases: true, thirdParties: false }
  await searchGlobally('900', 'all', siigo)
  expect(fetchElectronicDocuments).toHaveBeenCalledWith(expect.objectContaining({ provider: 'SIIGO', electronicDocumentType: 'PURCHASE_INVOICE', search: '900' }))
  expect(fetchElectronicDocuments).toHaveBeenCalledWith(expect.objectContaining({ provider: 'SIIGO', electronicDocumentType: 'SUPPORT_DOCUMENT' }))
  expect(fetchJarvisSalesInvoices).not.toHaveBeenCalled(); expect(fetchJarvisSupportInvoices).not.toHaveBeenCalled(); expect(fetchJarvisTerceros).not.toHaveBeenCalled()
  expect(availableSearchCategories(siigo).map(item => item.id)).toEqual(['purchases', 'support', 'products'])
})

it('conserva el número de documento soporte de Siigo sin reformatearlo', async () => {
  vi.mocked(fetchElectronicDocuments).mockResolvedValue({ items: [{ id: 's', invoiceNumber: 'DS001', supplierName: 'Proveedor', supplierNit: '900' }], total: 1 } as never)
  const [group] = await searchGlobally('DS', 'support', { ...access, provider: 'SIIGO' })
  expect(group.items[0].title).toBe('DS001')
})

it('abre facturas emitidas y borradores en su vista previa correspondiente', async () => {
  vi.mocked(fetchJarvisSalesInvoices).mockResolvedValue({ items: [
    { id: 'sent', prefix: 'FV', number: 'FV123', status: 'SENT', customerName: 'Cliente', customerIdentification: '900' },
    { id: 'draft/id', prefix: '', number: '', status: 'SAVED', customerName: 'Cliente' },
  ], total: 2 } as never)
  const [group] = await searchGlobally('Cliente', 'sales', access)
  expect(group.items[0]).toMatchObject({ title: 'FV-123', to: '/factura-venta/sent/visualizar' })
  expect(group.items[1]).toMatchObject({ title: 'Borrador', to: '/factura-venta/draft%2Fid/visualizar?borrador=1' })
})

it('descarta respuestas que llegaron después de cambiar de empresa', async () => {
  let complete!: (value: never) => void
  vi.mocked(fetchProducts).mockReturnValue(new Promise(resolve => { complete = resolve }))
  const pending = searchGlobally('Servicio', 'products', access)
  setActiveCompanyId('b'); complete({ items: [{ id: 'old' }], total: 1 } as never)
  expect(await pending).toEqual([])
})

it('lleva una compra al documento exacto y limita las sugerencias sin perder el total', async () => {
  vi.mocked(fetchElectronicDocuments).mockResolvedValue({ items: [{ id: 'doc-a', invoiceNumber: 'FC-123', supplierName: 'Proveedor', supplierNit: '900' }], total: 1 } as never)
  const [group] = await searchGlobally('123', 'purchases', { ...access, purchases: true })
  expect(group.items[0].to).toBe('/factura-compra?buscar=FC-123&documento=doc-a')
  vi.mocked(fetchProducts).mockResolvedValue({ items: Array.from({ length: 15 }, (_, i) => ({ id: String(i), sku: `P${i}`, name: 'Producto' })), total: 15 } as never)
  const [products] = await searchGlobally('Producto', 'products', access)
  expect(products.total).toBe(15); expect(products.items).toHaveLength(5)
})
