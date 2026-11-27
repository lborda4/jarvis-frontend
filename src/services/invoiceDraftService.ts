import { apiClient } from './apiClient'
import { companyQueryKey, invalidateQueryCache } from './queryCache'

export type InvoiceDraftKind = 'ELECTRONIC_INVOICE' | 'SUPPORT_DOCUMENT' | 'CREDIT_NOTE' | 'DEBIT_NOTE' | 'SUPPORT_CREDIT_NOTE'
export interface InvoiceDraftSummary {
  id: string
  documentKind: InvoiceDraftKind
  customerName: string | null
  issueDate: string | null
  updatedAt: string
}
const endpoint = '/integrations/jarvis/drafts'
export async function saveInvoiceDraft(id: string, documentKind: InvoiceDraftKind, state: object): Promise<void> {
  await apiClient.put(`${endpoint}/${encodeURIComponent(id)}`, { documentKind, state })
  invalidateQueryCache(companyQueryKey(['jarvis', 'history']))
}
export async function fetchInvoiceDraft<T>(id: string): Promise<{ documentKind: InvoiceDraftKind; state: T }> {
  return (await apiClient.get<{ draft: { documentKind: InvoiceDraftKind; state: T } }>(`${endpoint}/${encodeURIComponent(id)}`)).data.draft
}
export async function claimSalesImportDraft(id: string, state: object): Promise<string> {
  const { data } = await apiClient.post<{ token: string }>(`${endpoint}/${encodeURIComponent(id)}/sales-import-claim`, { state })
  if (!data.token) throw new Error('No se pudo confirmar la reserva del envío. Revisa el historial.')
  return data.token
}
export async function completeSalesImportDraft(id: string, token: string, invoiceId?: string): Promise<void> {
  await apiClient.post(`${endpoint}/${encodeURIComponent(id)}/sales-import-complete`, { token, ...(invoiceId ? { invoiceId } : {}) })
}
export async function fetchInvoiceDrafts(kind: InvoiceDraftKind): Promise<InvoiceDraftSummary[]> {
  return (await apiClient.get<{ items: InvoiceDraftSummary[] }>(endpoint, { params: { kind } })).data.items
}
export async function deleteInvoiceDraft(id: string): Promise<void> {
  await apiClient.delete(`${endpoint}/${encodeURIComponent(id)}`)
  invalidateQueryCache(companyQueryKey(['jarvis', 'history']))
}
