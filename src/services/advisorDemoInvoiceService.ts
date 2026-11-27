import { apiClient } from './apiClient'

export interface DemoInvoice {
  id: string
  number: string
  customerName: string
  customerIdentification: string
  description: string
  quantity: string
  unitValue: string
  total: string
  createdAt: string
}

export interface DemoInvoiceInput {
  id: string
  customerName: string
  customerIdentification: string
  description: string
  quantity: number
  unitValue: number
}

export async function fetchDemoInvoices(page: number): Promise<{ items: DemoInvoice[]; total: number; page: number; pageSize: number }> {
  return (await apiClient.get('/advisor/demo/invoices', { params: { page } })).data
}

export async function createDemoInvoice(input: DemoInvoiceInput): Promise<DemoInvoice> {
  return (await apiClient.post('/advisor/demo/invoices', input)).data
}
