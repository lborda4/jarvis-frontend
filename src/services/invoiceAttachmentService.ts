import { apiClient } from './apiClient'
import type { InvoiceDraftKind } from './invoiceDraftService'

export interface InvoiceAttachment { name: string; mimeType: string; size: number }
const endpoint = '/integrations/jarvis'

export async function uploadInvoiceAttachment(id: string, kind: InvoiceDraftKind, file: File): Promise<InvoiceAttachment> {
  const form = new FormData()
  form.append('documentKind', kind)
  form.append('file', file)
  return (await apiClient.post<{ attachment: InvoiceAttachment }>(`${endpoint}/drafts/${encodeURIComponent(id)}/attachment`, form, { timeout: 90000 })).data.attachment
}
export async function deleteInvoiceAttachment(id: string): Promise<void> {
  await apiClient.delete(`${endpoint}/drafts/${encodeURIComponent(id)}/attachment`)
}
export async function fetchInvoiceAttachment(id: string, draft = false): Promise<Blob> {
  return (await apiClient.get<Blob>(`${endpoint}/${draft ? 'drafts' : 'invoices'}/${encodeURIComponent(id)}/attachment`, { responseType: 'blob', timeout: 90000 })).data
}
