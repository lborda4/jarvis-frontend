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

export const SUPPORT_DOCUMENT_PAYMENT_DOCUMENT_TYPE = 'DS'
export const SUPPORT_DOCUMENT_RETE_ICA_TAX_TYPE = 'ReteICA'
export const SUPPORT_DOCUMENT_RETEFUENTE_TAX_TYPE = 'Retefuente'

export const SUPPORT_DOCUMENT_RETENTION_TAX_TYPES = [
  SUPPORT_DOCUMENT_RETE_ICA_TAX_TYPE,
  SUPPORT_DOCUMENT_RETEFUENTE_TAX_TYPE,
] as const

export function isSupportDocumentRetentionTaxType(type: string): boolean {
  const normalized = type
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  return normalized === 'reteica' || normalized === 'retefuente'
}
