import { beforeEach, describe, expect, it, vi } from 'vitest'
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('./apiClient', () => ({ apiClient: api }))
import { createJarvisDebitNote, fetchJarvisDebitNotes, fetchJarvisSalesInvoices, type CreateJarvisInvoiceRequest } from './jarvisService'
import { invalidateQueryCache, setActiveCompanyId } from './queryCache'

describe('Notas débito Jarvis', () => {
  beforeEach(() => { vi.resetAllMocks(); invalidateQueryCache(); setActiveCompanyId('company-1') })
  it('separa historial por documento y empresa', async () => {
    api.get.mockResolvedValue({ data: { items: [], total: 0 } })
    await fetchJarvisDebitNotes({}); await fetchJarvisDebitNotes({})
    expect(api.get).toHaveBeenCalledTimes(1)
    expect(api.get).toHaveBeenLastCalledWith('/integrations/jarvis/debit-notes', { params: {} })
    await fetchJarvisSalesInvoices({})
    expect(api.get).toHaveBeenCalledTimes(2)
    setActiveCompanyId('company-2')
    await fetchJarvisDebitNotes({})
    expect(api.get).toHaveBeenCalledTimes(3)
  })
  it('envía la referencia y refresca el historial después del éxito', async () => {
    const request: CreateJarvisInvoiceRequest = {
      issueDate: '2026-09-30', customerDocumentType: 'NIT', customerIdentification: '123',
      billingReference: { number: 'FV1', uuid: 'a'.repeat(96), issueDate: '2026-09-01' },
      discrepancyResponseCode: 3, discrepancyResponseDescription: 'Motivo',
      items: [{ description: 'Servicio', quantity: 1, unitValue: 100 }],
      payment: { id: 1, payment_form_id: 1, due_date: '2026-09-30' },
    }
    api.get.mockResolvedValue({ data: { items: [], total: 0 } })
    api.post.mockResolvedValue({ data: { success: true, invoice: { id: 'ND1' } } })
    await fetchJarvisDebitNotes({})
    await createJarvisDebitNote(request)
    expect(api.post).toHaveBeenCalledWith('/integrations/jarvis/debit-notes', request)
    await fetchJarvisDebitNotes({})
    expect(api.get).toHaveBeenCalledTimes(2)
  })
})
