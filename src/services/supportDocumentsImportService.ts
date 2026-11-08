import * as XLSX from 'xlsx'
import { getApiErrorMessage } from './apiClient'
import { fetchJarvisCatalogs, fetchJarvisTaxes, fetchJarvisTerceros } from './jarvisService'
import { fetchJarvisPaymentMethods } from './jarvisPaymentMethodService'
import { fetchInvoiceDrafts, saveInvoiceDraft } from './invoiceDraftService'
import { getActiveCompanyId } from './queryCache'
import { fetchJarvisSellers } from './jarvisSellerService'
import { SALES_TEMPLATE_FILENAME } from '../utils/salesInvoicesExcel'
import { buildSalesInvoiceTaxOptions } from '../utils/salesInvoiceTaxes'
import { createSupportDocumentsTemplate, resolveSupportSuppliers, SUPPORT_TEMPLATE_FILENAME, supportReferenceKey, type InvoiceImportKind, type SupportImportCatalogs, type SupportImportRow } from '../utils/supportDocumentsExcel'

export async function fetchSupportImportCatalogs(kind: InvoiceImportKind = 'support'): Promise<SupportImportCatalogs> {
  const [catalogs, savedTaxes, paymentMethods, sellers] = await Promise.all([fetchJarvisCatalogs(), fetchJarvisTaxes(), fetchJarvisPaymentMethods(), kind === 'sales' ? fetchJarvisSellers() : Promise.resolve(undefined)])
  return { taxes: buildSalesInvoiceTaxOptions(savedTaxes.items, catalogs.taxes), paymentMethods: paymentMethods.items,
    currencies: [...new Set(['COP', ...catalogs.currencies.map(item => item.code?.trim().toUpperCase()).filter((code): code is string => Boolean(code))])],
    ...(sellers ? { sellers } : {}),
  }
}
export async function downloadSupportImportTemplate(kind: InvoiceImportKind = 'support'): Promise<void> {
  const company = getActiveCompanyId()
  const catalogs = await fetchSupportImportCatalogs(kind)
  if (company !== getActiveCompanyId()) throw new Error('La empresa activa cambió. Descarga la plantilla de nuevo.')
  XLSX.writeFile(createSupportDocumentsTemplate(catalogs, kind), kind === 'sales' ? SALES_TEMPLATE_FILENAME : SUPPORT_TEMPLATE_FILENAME, { compression: true })
}

/** Stable company/reference IDs make retrying a lost PUT response safe and keep existing drafts intact. */
export async function assignSupportDraftIds(rows: SupportImportRow[], company: string | null, kind: InvoiceImportKind = 'support'): Promise<SupportImportRow[]> {
  return Promise.all(rows.map(async row => {
    const input = JSON.stringify([kind === 'sales' ? 'jarvis-sales-excel-v1' : 'jarvis-support-excel-v1', company, supportReferenceKey(row.reference)])
    const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))).slice(0, 16)
    bytes[6] = (bytes[6] & 0x0f) | 0x50
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
    const draftId = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
    return { ...row, draftId }
  }))
}
export class MissingSupportSuppliersError extends Error {
  rows: SupportImportRow[]
  constructor(rows: SupportImportRow[], kind: InvoiceImportKind = 'support') {
    super(`Hay NIT / identificaciones sin crear. Debes crearlos primero en Terceros antes de guardar ${kind === 'sales' ? 'las facturas de venta' : 'los documentos soporte'}.`)
    this.name = kind === 'sales' ? 'MissingSalesCustomersError' : 'MissingSupportSuppliersError'
    this.rows = rows
  }
}

export async function saveImportedSupportDocuments(rows: SupportImportRow[], onProgress: (row: SupportImportRow) => void, kind: InvoiceImportKind = 'support'): Promise<SupportImportRow[]> {
  if (rows.some(row => row.errors.length)) throw new Error('Corrige los errores del Excel antes de guardar.')
  const company = getActiveCompanyId()
  const documentKind = kind === 'sales' ? 'ELECTRONIC_INVOICE' : 'SUPPORT_DOCUMENT'
  const [suppliers, drafts, sellers] = await Promise.all([fetchJarvisTerceros(undefined, { force: true }), fetchInvoiceDrafts(documentKind),
    kind === 'sales' && rows.some(row => row.state.selectedSellers?.length) ? fetchJarvisSellers() : Promise.resolve(undefined)])
  if (company !== getActiveCompanyId()) throw new Error('La empresa activa cambió. Vuelve a cargar el archivo.')
  const result = await assignSupportDraftIds(resolveSupportSuppliers(rows, suppliers.items, kind), company, kind)
  if (result.some(row => row.status === 'missing_supplier')) throw new MissingSupportSuppliersError(result, kind)
  if (sellers) {
    if (result.some(row => row.state.selectedSellers?.some(selected => !sellers.some(seller => seller.id === selected.id)))) throw new Error('Un vendedor del Excel ya no está disponible. Revisa los vendedores y vuelve a cargar el archivo.')
    for (const row of result) row.state = { ...row.state, selectedSellers: sellers.filter(seller => row.state.selectedSellers?.some(selected => selected.id === seller.id)) }
  }
  const existing = new Set(drafts.map(draft => draft.id))
  let next = 0
  async function worker() {
    while (next < result.length) {
      const index = next++
      const row = result[index]
      if (row.status === 'saved' || row.status === 'duplicate') continue
      let updated: SupportImportRow
      if (existing.has(row.draftId!)) updated = { ...row, status: 'duplicate', message: 'La referencia ya tiene un documento guardado. Se conserva sin cambios.' }
      else {
        existing.add(row.draftId!)
        try {
          if (company !== getActiveCompanyId()) throw new Error('La empresa activa cambió. Vuelve a cargar el archivo.')
          await saveInvoiceDraft(row.draftId!, documentKind, { ...row.state, importReference: row.reference, importSource: kind === 'sales' ? 'sales-excel-v1' : 'support-excel-v1' })
          updated = { ...row, status: 'saved', message: 'Guardado. Puedes abrirlo para revisar y enviar a DIAN.' }
        } catch (error) { updated = { ...row, status: 'failed', message: getApiErrorMessage(error, 'No se pudo guardar el documento. Puedes reintentar.') } }
      }
      result[index] = updated
      onProgress(updated)
    }
  }
  await Promise.all(Array.from({ length: Math.min(3, rows.length) }, () => worker()))
  return result
}
