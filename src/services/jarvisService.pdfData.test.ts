import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PurchaseInvoiceDownload } from '../types/electronicDocument'

const api = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('./apiClient', () => ({ apiClient: api }))

import { fetchJarvisInvoicePdfData } from './jarvisService'
import { invalidateQueryCache, setActiveCompanyId } from './queryCache'

const item = { code: 'FV-01', description: 'Activación y configuración inicial', quantity: 1, unitValue: 100, discount: 0, ivaPercentage: 0, total: 100 }
const pdfData = { id: 'invoice-1', items: [item] } as PurchaseInvoiceDownload

describe('nombres de productos en los datos del PDF', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    invalidateQueryCache()
    setActiveCompanyId('company-1')
  })

  it.each([undefined, '', '   ', 'FV-01'])('resuelve el nombre por SKU cuando el PDF trae %s', name => {
    const data = { ...pdfData, items: [{ ...item, name }, { ...item, code: 'OTHER', name: 'Nombre guardado' }] }
    api.get.mockResolvedValueOnce({ data }).mockResolvedValueOnce({ data: { items: [
      { sku: 'OTHER', name: 'Otro producto' },
      { sku: 'FV-01', name: 'Activación de facturación' },
    ], total: 2 } })

    return fetchJarvisInvoicePdfData('invoice-1').then(result => {
      expect(result.items[0]).toEqual({ ...item, name: 'Activación de facturación' })
      expect(result.items[1].name).toBe('Nombre guardado')
      expect(data.items[0].name).toBe(name)
      expect(api.get).toHaveBeenNthCalledWith(1, '/integrations/jarvis/invoices/invoice-1/pdf-data')
      expect(api.get).toHaveBeenNthCalledWith(2, '/products')
    })
  })

  it('conserva los nombres guardados sin consultar el catálogo', async () => {
    const data = { ...pdfData, items: [{ ...item, name: 'Nombre original' }] }
    api.get.mockResolvedValueOnce({ data })
    expect(await fetchJarvisInvoicePdfData('invoice-1')).toBe(data)
    expect(api.get).toHaveBeenCalledTimes(1)
  })

  it('no consulta el catálogo en líneas sin código', async () => {
    const data = { ...pdfData, items: [{ ...item, code: null }] }
    api.get.mockResolvedValueOnce({ data })
    expect(await fetchJarvisInvoicePdfData('invoice-1')).toBe(data)
    expect(api.get).toHaveBeenCalledTimes(1)
  })

  it('mantiene disponible el PDF si el producto ya no existe', async () => {
    api.get.mockResolvedValueOnce({ data: pdfData }).mockResolvedValueOnce({ data: { items: [], total: 0 } })
    expect((await fetchJarvisInvoicePdfData('invoice-1')).items[0]).toEqual(item)
  })

  it('mantiene disponible el PDF si falla la consulta del catálogo', async () => {
    api.get.mockResolvedValueOnce({ data: pdfData }).mockRejectedValueOnce(new Error('Catálogo no disponible'))
    expect(await fetchJarvisInvoicePdfData('invoice-1')).toBe(pdfData)
  })
})
