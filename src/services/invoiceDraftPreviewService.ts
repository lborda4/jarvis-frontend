import { apiClient } from './apiClient'
import { fetchInvoiceDraft, type InvoiceDraftKind } from './invoiceDraftService'
import { fetchJarvisCredentialsStatus, fetchJarvisTaxes, fetchJarvisTerceros } from './jarvisService'
import { fetchJarvisPaymentMethods } from './jarvisPaymentMethodService'
import { invoiceDraftPdfData } from '../utils/invoiceDraftPdf'
import type { AuthCompany } from '../types/auth'
import type { InvoiceDraftState } from '../types/invoiceDraft'
import { fetchInvoiceAppearance } from './invoiceAppearanceService'

export async function fetchInvoiceDraftPreview(id: string, kind: InvoiceDraftKind, company: AuthCompany) {
  const draft = await fetchInvoiceDraft<Partial<InvoiceDraftState>>(id)
  if (draft.documentKind !== kind) throw new Error('El documento guardado corresponde a otro tipo de documento.')
  const [settings, taxes, methods, customer, logo, appearance] = await Promise.all([
    fetchJarvisCredentialsStatus(), fetchJarvisTaxes(), fetchJarvisPaymentMethods(),
    draft.state.selectedCustomer ? fetchJarvisTerceros(draft.state.selectedCustomer.document_number) : Promise.resolve(null),
    apiClient.get<{ logoDataUrl: string | null }>('/integrations/JARVIS/logo').then(response => response.data.logoDataUrl).catch(() => null),
    kind === 'ELECTRONIC_INVOICE' ? fetchInvoiceAppearance() : Promise.resolve(undefined),
  ])
  return { ...invoiceDraftPdfData({ id, kind, state: draft.state, company, settings, taxes: taxes.items, paymentMethods: methods.items,
    customer: customer?.items.find(item => item.id === draft.state.selectedCustomer?.id), logoDataUrl: logo }), invoiceAppearance: appearance }
}
