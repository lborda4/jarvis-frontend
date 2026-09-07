export interface SiigoTaxOption {
  id: number
  name: string
  type: string
  percentage: number
}

export const NONE_TAX_OPTION: SiigoTaxOption = {
  id: -1,
  name: 'Ninguno',
  type: '',
  percentage: 0,
}

export function isNoneTaxOption(
  option: SiigoTaxOption | null | undefined,
): boolean {
  return !option || option.id === NONE_TAX_OPTION.id
}

export function formatTaxOptionLabel(option: SiigoTaxOption): string {
  const percentageLabel =
    Number.isFinite(option.percentage) && option.percentage > 0
      ? ` (${option.percentage}%)`
      : ''

  return `${option.name}${percentageLabel}`
}

/** Igual que formatTaxOptionLabel, pero sin repetir el prefijo de
 * categoría del nombre (ej. "IVA Bienes" -> "Bienes") — para columnas que
 * ya dicen "IVA"/"Imp. Ret." en su encabezado, donde repetirlo en cada
 * opción del selector es ruido en vez de información (el catálogo de SIIGO
 * nombra sus impuestos con ese prefijo, ver GET /v1/taxes). Si el nombre no
 * empieza con el prefijo (ej. "Ninguno"), lo deja tal cual. Cuando el nombre
 * ES el prefijo entero (ej. name: "Retefuente", sin subcategoría — caso
 * real visto en catálogos SIIGO sin desglose), quitar el prefijo deja el
 * nombre vacío: en vez de volver a mostrar esa misma palabra sin nada más
 * (perdiendo el porcentaje, que es lo único que aporta info nueva ahí),
 * se muestra solo el porcentaje. */
export function formatTaxOptionLabelWithoutPrefix(
  prefix: string,
  option: SiigoTaxOption,
): string {
  const strippedName = option.name
    .replace(new RegExp(`^${prefix}\\s*`, 'i'), '')
    .trim()

  if (strippedName) {
    return formatTaxOptionLabel({ ...option, name: strippedName })
  }

  if (Number.isFinite(option.percentage) && option.percentage > 0) {
    return `${option.percentage}%`
  }

  return option.name
}

export const PURCHASE_INVOICE_PAYMENT_DOCUMENT_TYPE = 'FC'
export const SUPPORT_DOCUMENT_PAYMENT_DOCUMENT_TYPE = 'DS'
export const SUPPORT_DOCUMENT_RETE_ICA_TAX_TYPE = 'ReteICA'
export const PURCHASE_INVOICE_RETE_IVA_TAX_TYPE = 'ReteIVA'
export const SUPPORT_DOCUMENT_RETEFUENTE_TAX_TYPE = 'Retefuente'
/** IVA propiamente dicho (no ReteIVA) — solo aplica a Factura de compra SIIGO. */
export const PURCHASE_INVOICE_IVA_TAX_TYPE = 'IVA'

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

export function retentionTaxTypesMatch(
  leftType: string,
  rightType: string,
): boolean {
  return normalizeRetentionTaxType(leftType) === normalizeRetentionTaxType(rightType)
}

export function findRetentionByTaxType(
  retentions: SiigoTaxOption[],
  taxType: string,
): SiigoTaxOption | null {
  return (
    retentions.find((tax) => retentionTaxTypesMatch(tax.type, taxType)) ?? null
  )
}

export function splitRetentionsByTypes(
  retentions: SiigoTaxOption[],
  taxTypes: readonly string[],
): Record<string, SiigoTaxOption | null> {
  return Object.fromEntries(
    taxTypes.map((taxType) => [
      taxType,
      findRetentionByTaxType(retentions, taxType),
    ]),
  )
}

export function mergeRetentionsByTypes(
  selections: Record<string, SiigoTaxOption | null>,
  taxTypes: readonly string[],
): SiigoTaxOption[] {
  return taxTypes
    .map((taxType) => selections[taxType])
    .filter((tax): tax is SiigoTaxOption => Boolean(tax))
}

export function normalizeRetentionsForTypes(
  retentions: SiigoTaxOption[],
  taxTypes: readonly string[],
): SiigoTaxOption[] {
  return mergeRetentionsByTypes(
    splitRetentionsByTypes(retentions, taxTypes),
    taxTypes,
  )
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

const RETENTION_TYPE_DISPLAY_LABELS: Record<string, string> = {
  Retefuente: 'Retefuente',
  ReteICA: 'Rete ICA',
  ReteIVA: 'Rete IVA',
  ReteRenta: 'Rete Renta',
}

export function formatRetentionTypeDisplayLabel(type: string): string {
  return RETENTION_TYPE_DISPLAY_LABELS[type] ?? type
}
