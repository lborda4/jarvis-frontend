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
export async function fetchInvoiceDrafts(kind: InvoiceDraftKind): Promise<InvoiceDraftSummary[]> {
  return (await apiClient.get<{ items: InvoiceDraftSummary[] }>(endpoint, { params: { kind } })).data.items
}
export async function deleteInvoiceDraft(id: string): Promise<void> {
  await apiClient.delete(`${endpoint}/${encodeURIComponent(id)}`)
  invalidateQueryCache(companyQueryKey(['jarvis', 'history']))
}
