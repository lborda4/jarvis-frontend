import { getApiErrorMessage } from './apiClient'
import { claimSalesImportDraft, completeSalesImportDraft, fetchInvoiceDraft, saveInvoiceDraft } from './invoiceDraftService'
import { createJarvisInvoice, createJarvisSupportInvoice, type CreateJarvisInvoiceRequest } from './jarvisService'
import { getActiveCompanyId } from './queryCache'
import { fetchSupportImportCatalogs, saveImportedSupportDocuments } from './supportDocumentsImportService'
import { resolveJarvisPaymentMethodId } from './jarvisPaymentMethodService'
import { calculateSalesInvoiceTax, requireSalesInvoiceTaxCatalogId } from '../utils/salesInvoiceTaxes'
import { supportReferenceKey, type InvoiceImportKind, type SupportImportCatalogs, type SupportImportRow } from '../utils/supportDocumentsExcel'
import { buildPaymentBreakdown } from '../utils/paymentNegotiation'
import type { InvoiceDraftState } from '../types/invoiceDraft'
import { getColombiaToday } from '../utils/colombiaDate'

type ImportedDraftState = InvoiceDraftState & { importSource?: string; importReference?: string }

export function buildImportedSupportRequest(row: SupportImportRow, catalogs: SupportImportCatalogs, kind: InvoiceImportKind = 'support'): CreateJarvisInvoiceRequest {
  const state = row.state
  if (row.errors.length || !state.selectedCustomer) throw new Error('Corrige los errores y crea los terceros antes de enviar.')
  if (kind === 'sales' && state.selectedSellers?.some(selected => !catalogs.sellers?.some(seller => seller.id === selected.id))) throw new Error('Un vendedor ya no está disponible. Vuelve a cargar el Excel.')
  const tax = (id: string) => {
    const found = catalogs.taxes.find(item => item.id === id)
    if (!found) throw new Error('Un impuesto ya no está disponible. Vuelve a cargar el Excel.')
    return found
  }
  const retention = (id: string) => {
    const found = tax(id)
    return { id: requireSalesInvoiceTaxCatalogId(found), type: found.type, percentage: found.percentage ?? 0 }
  }
  const payment = state.paymentEntries[0]
  const methodId = resolveJarvisPaymentMethodId(catalogs.paymentMethods, payment?.methodId ?? '')
  if (!Number.isInteger(methodId) || methodId <= 0) throw new Error('La forma de pago no tiene un código válido para DIAN.')
  const retentions = [state.reteIvaId, state.reteIcaId].filter(Boolean).map(retention)
  return {
    issueDate: state.issueDate, customerDocumentType: state.selectedCustomer.document_type,
    customerIdentification: state.selectedCustomer.document_number, customerName: state.selectedCustomer.name,
    currency: state.currency,
    ...(kind === 'sales' ? { sellerIds: (state.selectedSellers ?? []).map(seller => seller.id), paymentBreakdown: buildPaymentBreakdown(state.paymentEntries, catalogs.paymentMethods),
      ...(state.headNote?.trim() ? { headNote: state.headNote.trim() } : {}), ...(state.footNote?.trim() ? { footNote: state.footNote.trim() } : {}) } : {}),
    ...(state.notes ? { observations: state.notes } : {}),
    items: state.lines.map(line => ({
      description: line.description, quantity: Number(line.quantity), unitValue: Number(line.unitValue), discount: Number(line.discount),
      taxAmount: calculateSalesInvoiceTax(Number(line.quantity) * Number(line.unitValue) - Number(line.discount), line.taxChargeId, line.taxPercent),
      ...(line.code ? { code: line.code } : {}), ...(line.notes ? { notes: line.notes } : {}),
      ...(line.taxChargeId ? { taxId: requireSalesInvoiceTaxCatalogId(tax(line.taxChargeId)) } : {}),
      ...(line.taxRetentionId ? { retention: retention(line.taxRetentionId) } : {}),
    })),
    ...(retentions.length ? { retentions: [...new Map(retentions.map(item => [item.id, item])).values()] } : {}),
    payment: { id: methodId, payment_form_id: Number(state.paymentFormId), due_date: state.dueDate },
  }
}

/** Persist an attempt before issuance: an interrupted response must never cause an automatic second issuance. */
export async function sendImportedSupportDocuments(rows: SupportImportRow[], onProgress: (row: SupportImportRow) => void, kind: InvoiceImportKind = 'support'): Promise<SupportImportRow[]> {
  if (rows.some(row => row.errors.length || row.status === 'missing_supplier')) throw new Error('Corrige los errores y crea los terceros antes de enviar.')
  const company = getActiveCompanyId()
  const documentKind = kind === 'sales' ? 'ELECTRONIC_INVOICE' : 'SUPPORT_DOCUMENT'
  const importSource = kind === 'sales' ? 'sales-excel-v1' : 'support-excel-v1'
  const buildRequest = (row: SupportImportRow) => buildImportedSupportRequest(row, catalogs, kind)
  const checkCompany = () => {
    if (company !== getActiveCompanyId()) throw new Error('La empresa activa cambió. Vuelve a cargar el Excel.')
  }
  const catalogs = await fetchSupportImportCatalogs(kind)
  checkCompany()
  // Validate the entire batch before saving or issuing any document.
  rows.filter(row => row.status !== 'duplicate' && !row.delivery).forEach(row => {
    if (kind === 'sales' && row.state.issueDate !== getColombiaToday())
      throw new Error('Las facturas de venta se emiten con la fecha actual de Colombia. Actualiza la fecha de emisión del Excel antes de enviar.')
    buildRequest(row)
  })
  const result = await saveImportedSupportDocuments(rows, onProgress, kind)
  checkCompany()
  if (result.some(row => row.status === 'failed')) return result
  for (let index = 0; index < result.length; index++) {
    let row = result[index]
    if (!['saved', 'duplicate'].includes(row.status) || row.delivery) continue
    let attempted = false
    try {
      checkCompany()
      const draft = await fetchInvoiceDraft<ImportedDraftState>(row.draftId!)
      checkCompany()
      if (draft.documentKind !== documentKind) throw new Error(kind === 'sales' ? 'El borrador no es una factura de venta.' : 'El borrador no es un documento soporte.')
      if (draft.state.importDelivery) {
        row = { ...row, status: 'saved', delivery: draft.state.importDelivery.status === 'sent' ? 'sent' : 'uncertain', invoiceId: draft.state.importDelivery.invoiceId,
          message: draft.state.importDelivery.status === 'sent' ? 'Ya enviado a DIAN.' : 'Hay un envío por confirmar. Revisa el historial antes de volver a enviar.' }
      } else {
        if (row.status === 'duplicate') {
          // Resume matching Excel drafts after an interrupted batch, preserving edited drafts.
          if (draft.state.importSource !== importSource
            || supportReferenceKey(draft.state.importReference ?? '') !== supportReferenceKey(row.reference)
            || JSON.stringify(buildRequest({ ...row, state: draft.state })) !== JSON.stringify(buildRequest(row))) continue
          row = { ...row, state: draft.state, status: 'saved' }
        }
        if (kind === 'sales' && row.state.issueDate !== getColombiaToday())
          throw new Error('La fecha cambió durante el envío. Actualiza el Excel con la fecha actual de Colombia antes de continuar.')
        const request = buildRequest(row)
        let claimToken = ''
        if (kind === 'sales') {
          attempted = true
          claimToken = await claimSalesImportDraft(row.draftId!, draft.state)
        } else {
          await saveInvoiceDraft(row.draftId!, documentKind, { ...row.state, importReference: row.reference, importSource, importDelivery: { status: 'sending' } })
          attempted = true
        }
        checkCompany()
        onProgress({ ...row, delivery: 'sending', message: 'Enviando a DIAN…' })
        // Sequential issuance lets the existing endpoint allocate official consecutives.
        const response = await (kind === 'sales' ? createJarvisInvoice : createJarvisSupportInvoice)(request)
        if (!response.success || !response.invoice?.id) throw new Error('No se recibió confirmación del envío.')
        row = { ...row, delivery: 'sent', invoiceId: response.invoice.historyId,
          message: `Enviado a DIAN. Documento ${response.invoice.consecutive ?? response.invoice.number ?? response.invoice.id}.` }
        onProgress(row)
        try {
          checkCompany()
          if (kind === 'sales') await completeSalesImportDraft(row.draftId!, claimToken, row.invoiceId)
          else await saveInvoiceDraft(row.draftId!, documentKind, { ...row.state, importReference: row.reference, importSource, importDelivery: { status: 'sent', invoiceId: row.invoiceId } })
        } catch {
          row = { ...row, message: `${row.message} No se pudo actualizar el borrador; el envío está confirmado.` }
        }
      }
    } catch (error) {
      row = { ...row, ...(attempted ? { delivery: 'uncertain' as const } : row.status === 'duplicate' ? { status: 'failed' as const } : {}),
        message: attempted ? `${getApiErrorMessage(error, 'No se pudo confirmar el envío.')} Revisa el historial DIAN antes de volver a enviar.`
          : getApiErrorMessage(error, 'No se pudo preparar el envío. Puedes reintentar.') }
    }
    result[index] = row
    onProgress(row)
  }
  return result
}
