export interface SiigoTaxOption {
  id: number
  name: string
  type: string
  percentage: number
}

export function formatTaxOptionLabel(option: SiigoTaxOption): string {
  const percentageLabel =
    Number.isFinite(option.percentage) && option.percentage > 0
      ? ` (${option.percentage}%)`
      : ''

  return `${option.name}${percentageLabel}`
}

export const PURCHASE_INVOICE_PAYMENT_DOCUMENT_TYPE = 'FC'
export const SUPPORT_DOCUMENT_PAYMENT_DOCUMENT_TYPE = 'DS'
export const SUPPORT_DOCUMENT_RETE_ICA_TAX_TYPE = 'ReteICA'
export const PURCHASE_INVOICE_RETE_IVA_TAX_TYPE = 'ReteIVA'
export const SUPPORT_DOCUMENT_RETEFUENTE_TAX_TYPE = 'Retefuente'

export const SUPPORT_DOCUMENT_RETENTION_CATALOG_TYPES = [
  SUPPORT_DOCUMENT_RETE_ICA_TAX_TYPE,
  SUPPORT_DOCUMENT_RETEFUENTE_TAX_TYPE,
] as const

export const PURCHASE_INVOICE_RETENTION_CATALOG_TYPES = [
  SUPPORT_DOCUMENT_RETE_ICA_TAX_TYPE,
  PURCHASE_INVOICE_RETE_IVA_TAX_TYPE,
  SUPPORT_DOCUMENT_RETEFUENTE_TAX_TYPE,
] as const

export const SUPPORT_DOCUMENT_RETENTION_TAX_TYPES = [
  SUPPORT_DOCUMENT_RETE_ICA_TAX_TYPE,
  SUPPORT_DOCUMENT_RETEFUENTE_TAX_TYPE,
] as const

function normalizeRetentionTaxType(type: string): string {
  return type
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function isAllowedRetentionTaxType(
  type: string,
  allowedTypes: readonly string[],
): boolean {
  const normalized = normalizeRetentionTaxType(type)

  return allowedTypes.some(
    (allowedType) => normalizeRetentionTaxType(allowedType) === normalized,
  )
}

export function isSupportDocumentRetentionTaxType(type: string): boolean {
  return isAllowedRetentionTaxType(type, SUPPORT_DOCUMENT_RETENTION_TAX_TYPES)
}

export function isPurchaseInvoiceRetentionTaxType(type: string): boolean {
  return isAllowedRetentionTaxType(type, PURCHASE_INVOICE_RETENTION_CATALOG_TYPES)
}
