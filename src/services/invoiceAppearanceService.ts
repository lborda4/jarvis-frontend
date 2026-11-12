import { apiClient } from './apiClient'
import { normalizeInvoiceAppearance, type InvoiceAppearance } from '../utils/invoiceAppearance'

const endpoint = '/integrations/jarvis/invoice-appearance'

export async function fetchInvoiceAppearance(signal?: AbortSignal): Promise<InvoiceAppearance> {
  const { data } = await apiClient.get<InvoiceAppearance>(endpoint, { signal })
  return normalizeInvoiceAppearance(data)
}

export async function saveInvoiceAppearance(settings: InvoiceAppearance): Promise<InvoiceAppearance> {
  const { data } = await apiClient.put<InvoiceAppearance>(endpoint, settings)
  return normalizeInvoiceAppearance(data)
}
