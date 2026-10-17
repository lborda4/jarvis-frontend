import { beforeEach, expect, it, vi } from 'vitest'
import { apiClient } from './apiClient'
import { saveInvoiceDraft, fetchInvoiceDraft, fetchInvoiceDrafts } from './invoiceDraftService'
vi.mock('./apiClient', () => ({ apiClient: { put: vi.fn(), get: vi.fn(), post: vi.fn() } }))
beforeEach(() => vi.clearAllMocks())

it('guarda un formulario incompleto como borrador sin llamar al endpoint de emision', async () => {
  const state = { selectedCustomer: null, lines: [], notes: 'Continuar mañana' }
  await saveInvoiceDraft('draft-id', 'ELECTRONIC_INVOICE', state)
  expect(apiClient.put).toHaveBeenCalledWith('/integrations/jarvis/drafts/draft-id', { documentKind: 'ELECTRONIC_INVOICE', state })
  expect(apiClient.post).not.toHaveBeenCalled()
})
it('recupera el estado original para continuar editando', async () => {
  const draft = { documentKind: 'ELECTRONIC_INVOICE', state: { notes: 'Pendiente', lines: [{ description: 'Servicio', quantity: '2' }] } }
  vi.mocked(apiClient.get).mockResolvedValue({ data: { draft } })
  expect(await fetchInvoiceDraft('draft-id')).toEqual(draft)
})
it('lista los borradores del tipo de documento correspondiente', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({ data: { items: [] } })
  await fetchInvoiceDrafts('ELECTRONIC_INVOICE')
  expect(apiClient.get).toHaveBeenCalledWith('/integrations/jarvis/drafts', { params: { kind: 'ELECTRONIC_INVOICE' } })
})
