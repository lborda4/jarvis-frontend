import { fetchJarvisInvoiceDetail } from './jarvisService'
import { apiClient } from './apiClient'

export async function invoiceNoteBlockReasonByCufe(cufe: string): Promise<string | null> {
  const { data } = await apiClient.post<{ source: string; allowed: boolean; blockReason: string | null }>(
    '/integrations/jarvis/radian/note-eligibility', { cufe },
  )
  if (data?.source !== 'nextpyme' || typeof data.allowed !== 'boolean' ||
    (data.allowed ? data.blockReason !== null : typeof data.blockReason !== 'string' || !data.blockReason.trim())) {
    throw new Error('NextPyme no confirmó la aceptación RADIAN de esta factura.')
  }
  return data.allowed ? null : data.blockReason
}

export async function invoiceNoteBlockReason(invoiceId: string): Promise<string | null> {
  const invoice = await fetchJarvisInvoiceDetail(invoiceId)
  if (!invoice.cufe?.trim()) throw new Error('La factura no tiene CUFE para consultar RADIAN.')
  return invoiceNoteBlockReasonByCufe(invoice.cufe.trim())
}
