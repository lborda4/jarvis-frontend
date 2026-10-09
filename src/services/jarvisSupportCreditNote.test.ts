import { beforeEach, describe, expect, it, vi } from 'vitest'
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('./apiClient', () => ({ apiClient: api }))
import {
  createJarvisSupportCreditNote,
  fetchJarvisSalesInvoices,
  fetchJarvisSupportCreditNotes,
  fetchJarvisSupportDocumentDetail,
  type CreateJarvisInvoiceRequest,
} from './jarvisService'
import { invalidateQueryCache, setActiveCompanyId } from './queryCache'

describe('Notas de ajuste Jarvis', () => {
  beforeEach(() => { vi.resetAllMocks(); invalidateQueryCache(); setActiveCompanyId('company-1') })
  it('separa historial por documento y empresa', async () => {
    api.get.mockResolvedValue({ data: { items: [], total: 0 } })
    await fetchJarvisSupportCreditNotes({}); await fetchJarvisSupportCreditNotes({})
    expect(api.get).toHaveBeenCalledTimes(1)
    expect(api.get).toHaveBeenLastCalledWith('/integrations/jarvis/support-credit-notes', { params: {} })
    await fetchJarvisSalesInvoices({})
    expect(api.get).toHaveBeenCalledTimes(2)
    setActiveCompanyId('company-2')
    await fetchJarvisSupportCreditNotes({})
    expect(api.get).toHaveBeenCalledTimes(3)
  })
  it('precarga el documento soporte afectado', async () => {
    api.get.mockResolvedValue({ data: { id: 'ds-1', number: 'DS1' } })
    await expect(fetchJarvisSupportDocumentDetail('ds-1')).resolves.toEqual({ id: 'ds-1', number: 'DS1' })
    expect(api.get).toHaveBeenCalledWith('/integrations/jarvis/support-documents/ds-1')
  })
  it('envía la referencia y refresca el historial después del éxito', async () => {
    const request: CreateJarvisInvoiceRequest = {
      issueDate: '2026-09-30', customerDocumentType: 'NIT', customerIdentification: '123',
      billingReference: { number: 'DS1', uuid: 'b'.repeat(96), issueDate: '2026-09-01' },
      discrepancyResponseCode: 2, discrepancyResponseDescription: 'Motivo',
      items: [{ description: 'Comisión', quantity: 1, unitValue: 200 }],
      payment: { id: 1, payment_form_id: 1, due_date: '2026-09-30' },
    }
    api.get.mockResolvedValue({ data: { items: [], total: 0 } })
    api.post.mockResolvedValue({ data: { success: true, invoice: { id: 'NDS1' } } })
    await fetchJarvisSupportCreditNotes({})
    await createJarvisSupportCreditNote(request)
    expect(api.post).toHaveBeenCalledWith('/integrations/jarvis/support-credit-notes', request)
    await fetchJarvisSupportCreditNotes({})
    expect(api.get).toHaveBeenCalledTimes(2)
  })
})
