import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as XLSX from 'xlsx'
import type { JarvisTercero } from '../types/jarvis'
import { apiClient } from './apiClient'
import { setActiveCompanyId } from './queryCache'
import { assignSupportDraftIds } from './supportDocumentsImportService'
import { assignSalesDraftIds, fetchSalesImportCatalogs, MissingSalesCustomersError, saveImportedSalesInvoices } from './salesInvoicesImportService'
import { createSalesInvoicesTemplate, readSalesInvoicesWorkbook } from '../utils/salesInvoicesExcel'

vi.mock('./apiClient', () => ({ apiClient: { get: vi.fn(), put: vi.fn(), post: vi.fn() }, getApiErrorMessage: (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback }))
const customer = { id: 'client', document_type: 'NIT', document_number: '900123', name: 'Cliente' } as JarvisTercero
function rows(references = ['FV-1']) {
  const book = createSalesInvoicesTemplate()
  XLSX.utils.sheet_add_aoa(book.Sheets['Facturas de venta'], references.map(reference => [reference, '2026-11-07', 'NIT', '900123', 'Servicio', 1, 100, 'Efectivo']), { origin: 'A2' })
  return readSalesInvoicesWorkbook(XLSX.write(book, { type: 'array', bookType: 'xlsx' }), { currencies: ['COP'], taxes: [], paymentMethods: [{ id: 'cash', name: 'Efectivo', negotiation: 'CASH', nextpymeMethodId: 10, nextpymeMethodName: 'Efectivo' }] }, [customer])
}
describe('guardado masivo de facturas de venta', () => {
  beforeEach(() => {
    vi.resetAllMocks(); setActiveCompanyId(null); setActiveCompanyId('company-a')
    vi.mocked(apiClient.get).mockImplementation(async url => ({ data: { items: url === '/integrations/jarvis/terceros' ? [customer] : [] } }))
    vi.mocked(apiClient.put).mockResolvedValue({ data: {} })
  })
  it('guarda una factura editable como ELECTRONIC_INVOICE y consulta únicamente sus borradores', async () => {
    const result = await saveImportedSalesInvoices(rows(), vi.fn())
    expect(result[0].status).toBe('saved')
    expect(apiClient.get).toHaveBeenCalledWith('/integrations/jarvis/drafts', { params: { kind: 'ELECTRONIC_INVOICE' } })
    expect(apiClient.put).toHaveBeenCalledWith(`/integrations/jarvis/drafts/${result[0].draftId}`, { documentKind: 'ELECTRONIC_INVOICE', state: expect.objectContaining({ selectedCustomer: expect.objectContaining({ id: 'client' }), importReference: 'FV-1', importSource: 'sales-excel-v1', documentTotal: 100 }) })
    expect(apiClient.post).not.toHaveBeenCalled()
  })
  it('aísla referencias entre facturas de venta, documentos soporte y empresas', async () => {
    const sales = await assignSalesDraftIds(rows(), 'company-a')
    const support = await assignSupportDraftIds(rows(), 'company-a')
    expect(sales[0].draftId).not.toBe(support[0].draftId)
    expect(sales[0].draftId).toBe((await assignSalesDraftIds(rows(['fv-1']), 'company-a'))[0].draftId)
    expect(sales[0].draftId).not.toBe((await assignSalesDraftIds(rows(), 'company-b'))[0].draftId)
  })
  it('no guarda ninguna factura si un cliente falta al revalidar en el servidor', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { items: [] } })
    await expect(saveImportedSalesInvoices(rows(['FV-1', 'FV-2']), vi.fn())).rejects.toBeInstanceOf(MissingSalesCustomersError)
    await expect(saveImportedSalesInvoices(rows(), vi.fn())).rejects.toThrow('facturas de venta')
    expect(apiClient.put).not.toHaveBeenCalled()
    expect(apiClient.post).not.toHaveBeenCalled()
  })
  it('omite referencias guardadas sin sobrescribirlas', async () => {
    const input = await assignSalesDraftIds(rows(), 'company-a')
    vi.mocked(apiClient.get).mockImplementation(async url => ({ data: { items: url === '/integrations/jarvis/terceros' ? [customer] : [{ id: input[0].draftId }] } }))
    expect((await saveImportedSalesInvoices(input, vi.fn()))[0].status).toBe('duplicate')
    expect(apiClient.put).not.toHaveBeenCalled()
  })
  it('mantiene los resultados parciales y reintenta solamente los pendientes con el mismo ID', async () => {
    vi.mocked(apiClient.put).mockRejectedValueOnce(new Error('Sin conexión'))
    const first = await saveImportedSalesInvoices(rows(['FV-1', 'FV-2']), vi.fn())
    expect(first.map(row => row.status)).toEqual(['failed', 'saved'])
    vi.mocked(apiClient.put).mockClear()
    const second = await saveImportedSalesInvoices(first, vi.fn())
    expect(apiClient.put).toHaveBeenCalledTimes(1)
    expect(second[0].draftId).toBe(first[0].draftId)
    expect(second.every(row => row.status === 'saved')).toBe(true)
  })
  it('actualiza los vendedores guardados y bloquea vendedores que ya no existen', async () => {
    const input = rows(); input[0].state.selectedSellers = [{ id: 'seller', name: 'Nombre antiguo' }]
    await expect(saveImportedSalesInvoices(input, vi.fn())).rejects.toThrow('vendedor')
    expect(apiClient.put).not.toHaveBeenCalled()
    vi.mocked(apiClient.get).mockImplementation(async url => ({ data: { items: url === '/integrations/jarvis/terceros' ? [customer] : url === '/integrations/jarvis/sellers' ? [{ id: 'seller', name: 'Nombre actual' }] : [] } }))
    const result = await saveImportedSalesInvoices(input, vi.fn())
    expect(result[0].state.selectedSellers).toEqual([{ id: 'seller', name: 'Nombre actual' }])
  })
  it('consulta vendedores al preparar los catálogos de ventas', async () => {
    vi.mocked(apiClient.get).mockImplementation(async url => ({ data: url === '/integrations/jarvis/catalogs' ? { taxes: [], currencies: [] } : { items: [] } }))
    const catalogs = await fetchSalesImportCatalogs()
    expect(catalogs.sellers).toEqual([])
    expect(apiClient.get).toHaveBeenCalledWith('/integrations/jarvis/sellers')
  })
  it('detiene los guardados si cambia la empresa activa', async () => {
    vi.mocked(apiClient.get).mockImplementation(async () => { setActiveCompanyId('company-b'); return { data: { items: [] } } })
    await expect(saveImportedSalesInvoices(rows(), vi.fn())).rejects.toThrow('empresa activa cambió')
    expect(apiClient.put).not.toHaveBeenCalled()
  })
})
