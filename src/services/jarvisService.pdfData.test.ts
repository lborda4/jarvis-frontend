import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PurchaseInvoiceDownload } from '../types/electronicDocument'

const api = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('./apiClient', () => ({ apiClient: api }))
import { fetchJarvisInvoicePdfData } from './jarvisService'

describe('datos históricos de documentos emitidos', () => {
  beforeEach(() => vi.resetAllMocks())
  it.each([undefined, '', 'FV-01', 'Nombre original'])('conserva el nombre histórico %s sin consultar productos ni terceros actuales', async name => {
    const data = { id: 'invoice-1', items: [{ code: 'FV-01', name, description: 'Descripción enviada', quantity: 1, unitValue: 100, total: 100 }], buyer: { name: 'Cliente original' } } as PurchaseInvoiceDownload
    api.get.mockResolvedValueOnce({ data })
    api.get.mockImplementation(async () => { throw new Error('No consultar catálogos actuales') })
    const result = await fetchJarvisInvoicePdfData('invoice-1')
    expect(result).toBe(data)
    expect(result.items[0].name).toBe(name)
    expect(result.buyer.name).toBe('Cliente original')
    expect(api.get).toHaveBeenCalledExactlyOnceWith('/integrations/jarvis/invoices/invoice-1/pdf-data')
  })
})
