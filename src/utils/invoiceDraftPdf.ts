import type { AuthCompany } from '../types/auth'
import type { PurchaseInvoiceDownload, PurchaseInvoiceDownloadParty, PurchaseInvoiceDownloadWithholding } from '../types/electronicDocument'
import type { InvoiceDraftState } from '../types/invoiceDraft'
import type { JarvisCredentialsStatusResponse, JarvisTax, JarvisTercero } from '../types/jarvis'
import type { InvoiceDraftKind } from '../services/invoiceDraftService'
import type { JarvisPaymentMethod } from '../services/jarvisPaymentMethodService'
import { balancePayments } from './paymentBalance'
import { isCreditPaymentMethod } from './paymentNegotiation'
import { calculateSalesInvoiceTax } from './salesInvoiceTaxes'
import { calculateJarvisRetention } from './jarvisTaxTechnical'
import { JARVIS_TAX_RATES, normalizeJarvisTaxType } from './jarvisTaxPresets'

const amount = (value: unknown): number => {
  const parsed = Number(String(value ?? '').replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : 0
}
const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100
const party = (fields: Partial<PurchaseInvoiceDownloadParty>): PurchaseInvoiceDownloadParty => ({
  name: null, documentType: null, documentNumber: null, checkDigit: null, address: null, phone: null, email: null, cityName: null, ...fields,
})

/** A draft uses local saved values; previewing never allocates a number or issues a document. */
export function invoiceDraftPdfData(input: {
  id: string; kind: InvoiceDraftKind; state: Partial<InvoiceDraftState>; company: AuthCompany
  settings: Partial<JarvisCredentialsStatusResponse>; taxes?: JarvisTax[]; paymentMethods?: JarvisPaymentMethod[]
  customer?: JarvisTercero; logoDataUrl?: string | null
}): PurchaseInvoiceDownload {
  const { id, kind, state, company, settings, customer } = input
  const taxFor = (id: string | undefined) => {
    if (!id) return undefined
    const saved = input.taxes?.find(tax => `saved:${tax.id}` === id)
    if (saved) return { type: saved.tax_type, rate: saved.rate ?? 0 }
    for (const [type, rates] of Object.entries(JARVIS_TAX_RATES)) {
      const rate = rates.find(rate => `default:${normalizeJarvisTaxType(type)}${rate}` === id)
      if (rate != null) return { type, rate }
    }
    return undefined
  }
  const retention = (id: string | undefined, base: number, iva: number): PurchaseInvoiceDownloadWithholding[] => {
    const tax = taxFor(id)
    if (!tax) return []
    const type = normalizeJarvisTaxType(tax.type)
    return [{ dianTaxCode: type === 'reteiva' ? '05' : type === 'reteica' ? '07' : '06', name: tax.type,
      percentage: tax.rate, amount: calculateJarvisRetention(tax.type, tax.rate, base, iva) }]
  }
  const items = (Array.isArray(state.lines) ? state.lines : []).filter(line =>
    line.description?.trim() || line.notes?.trim() || line.productSearch?.trim() || line.code?.trim() || amount(line.unitValue),
  ).map(line => {
    const quantity = Math.max(0, amount(line.quantity))
    const unitValue = Math.max(0, amount(line.unitValue))
    const gross = quantity * unitValue
    const discount = money(Math.max(0, amount(line.discount)) * (state.discountIsPercent ? gross / 100 : 1))
    const base = money(Math.max(0, gross - discount))
    const taxAmount = calculateSalesInvoiceTax(base, line.taxChargeId ?? '', line.taxPercent ?? '0')
    const type = taxFor(line.taxChargeId)?.type ?? 'IVA'
    const ivaAmount = normalizeJarvisTaxType(type) === 'iva' ? taxAmount : 0
    const productName = line.productSearch?.replace(/^.*? — /, '').trim()
    return { description: [line.description?.trim(), line.notes?.trim()].filter(Boolean).join('\n'), name: productName || null, code: line.code?.trim() || null,
      quantity, unitValue, discount, total: base, ivaAmount,
      ivaPercentage: line.taxChargeId && normalizeJarvisTaxType(type) === 'iva' ? Math.max(0, amount(line.taxPercent)) : 0,
      taxes: line.taxChargeId ? [{ type, amount: taxAmount }] : [],
      withholdings: retention(line.taxRetentionId, base, taxAmount) }
  })
  const subtotal = money(items.reduce((sum, item) => sum + item.total, 0))
  const taxTotals = new Map<string, number>()
  for (const item of items) for (const tax of item.taxes) taxTotals.set(tax.type, money((taxTotals.get(tax.type) ?? 0) + tax.amount))
  const taxes = [...taxTotals].map(([type, amount]) => ({ type, amount }))
  const totalTax = money(taxes.reduce((sum, tax) => sum + tax.amount, 0))
  const withholdings = [...items.flatMap(item => item.withholdings), ...retention(state.reteIcaId, subtotal, totalTax), ...retention(state.reteIvaId, subtotal, totalTax)]
  const documentDiscount = kind === 'DEBIT_NOTE' ? Math.max(0, amount(state.generalDiscount)) : 0
  const taxInclusiveAmount = money(subtotal + totalTax - documentDiscount)
  const total = money(taxInclusiveAmount - withholdings.reduce((sum, tax) => sum + (tax.amount ?? 0), 0))
  const methods = input.paymentMethods ?? []
  const credit = state.paymentFormId === '2' || state.paymentFormId === 'MIXED'
  const entries = balancePayments(state.paymentEntries ?? [], Math.max(0, total))
  const paymentBreakdown = entries.filter(entry => amount(entry.amount) > 0).map(entry => {
    const method = methods.find(method => method.id === entry.methodId)
    return { methodId: entry.methodId, methodName: method?.name ?? 'Sin seleccionar', nextpymeMethodId: method?.nextpymeMethodId ?? 0,
      negotiation: (method ? isCreditPaymentMethod(method) : credit) ? 'CREDIT' as const : 'CASH' as const, amount: amount(entry.amount) }
  })
  const resolution = kind === 'SUPPORT_DOCUMENT' ? settings.supportDocumentResolution
    : kind === 'CREDIT_NOTE' ? settings.creditNoteResolution : kind === 'DEBIT_NOTE' ? settings.debitNoteResolution
      : kind === 'SUPPORT_CREDIT_NOTE' ? settings.supportCreditNoteResolution : settings.electronicInvoiceResolution
  const [nit, dv] = company.nit.split('-')
  return {
    id, isDraft: true, documentKind: kind, invoiceNumber: 'Sin número', prefix: resolution?.prefix ?? null,
    cufe: '', dianQrText: '', dianQrUrl: '', issueDate: state.issueDate || null, dueDate: state.dueDate || null,
    isCreditPayment: state.paymentFormId ? credit : null, currency: state.currency || 'COP',
    observations: [state.headNote, state.notes, state.footNote].filter(note => note?.trim()).join('\n') || null,
    issuer: party({ name: settings.business_name || company.name, tradeName: settings.trade_name, documentType: 'NIT',
      documentNumber: nit, checkDigit: dv || null, address: settings.address, phone: settings.phone, email: settings.email,
      cityName: settings.city || settings.municipality, countryName: settings.country, departmentName: settings.department }),
    buyer: party({ name: state.selectedCustomer?.name || state.customerQuery?.trim() || null, documentType: state.selectedCustomer?.document_type ?? null,
      documentNumber: state.selectedCustomer?.document_number ?? null, checkDigit: state.selectedCustomer?.check_digit ?? null,
      address: customer?.address, phone: customer?.phone, email: customer?.email }),
    issuerTaxProfile: { source: 'current', vatRegime: settings.vat_regime, economicActivity: settings.economic_activity,
      taxResponsibility: settings.tax_responsibility, icaRate: settings.ica_rate },
    items, subtotal, iva: money(items.reduce((sum, item) => sum + item.ivaAmount, 0)), taxes,
    discount: money(items.reduce((sum, item) => sum + item.discount, 0) + documentDiscount),
    taxExclusiveAmount: money(subtotal - documentDiscount), taxInclusiveAmount, total, withholdings, paymentBreakdown,
    sellers: state.selectedSellers, attachment: state.attachment, logoDataUrl: input.logoDataUrl,
    references: state.billingNumber ? [{ type: 'Factura relacionada', number: state.billingNumber, date: state.billingDate || null }] : [],
    authorization: resolution ? { number: resolution.formNumber ?? null, from: String(resolution.fromNumber),
      to: String(resolution.toNumber), startDate: resolution.dateFrom ?? null, endDate: resolution.dateTo ?? null } : undefined,
  }
}
