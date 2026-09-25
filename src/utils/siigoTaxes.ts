import type { SiigoTaxOption } from '../constants/siigoTaxCatalog'
import type { SiigoTaxCatalogItem } from '../types/siigo'

export function mapCatalogItemToTaxOption(
  item: SiigoTaxCatalogItem,
): SiigoTaxOption {
  return {
    id: item.id,
    name: item.name,
    type: item.type,
    percentage: item.percentage,
  }
}

export function mapSuggestedRetentionToTaxOption(
  retention: {
    id: number
    name: string
    type: string
    percentage: number
  },
): SiigoTaxOption {
  return {
    id: retention.id,
    name: retention.name,
    type: retention.type,
    percentage: retention.percentage,
  }
}

export function mapSuggestedRetentionsToTaxOptions(
  retentions: Array<{
    id: number
    name: string
    type: string
    percentage: number
  }> | null | undefined,
): SiigoTaxOption[] {
  if (!retentions?.length) {
    return []
  }

  return retentions.map(mapSuggestedRetentionToTaxOption)
}

export function mapCatalogToTaxOptions(
  items: SiigoTaxCatalogItem[],
): SiigoTaxOption[] {
  return items.map(mapCatalogItemToTaxOption)
}

const IVA_MATCH_TOLERANCE = 0.01

function scoreIvaTaxName(name: string): number {
  const normalized = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  if (/activo\s*fijo|fixed\s*asset/.test(normalized)) {
    return 100
  }

  if (/compra/.test(normalized)) {
    return 0
  }

  if (/bienes|general|gravado/.test(normalized)) {
    return 1
  }

  if (/servicio/.test(normalized)) {
    return 2
  }

  return 10
}

/** Cuando hay varios IVA a la misma tarifa (ej. "IVA 19%" e "IVA Activo
 * Fijo"), elige el de compras/general. El primero del catálogo solía ser
 * Activo Fijo y SIIGO recibía ese impuesto aunque el ítem fuera una cuenta
 * de gasto. */
export function pickPreferredIvaTax<T extends { name: string }>(
  matches: T[],
): T | null {
  if (matches.length === 0) {
    return null
  }

  if (matches.length === 1) {
    return matches[0]
  }

  return [...matches].sort((left, right) => {
    const scoreDiff = scoreIvaTaxName(left.name) - scoreIvaTaxName(right.name)

    return scoreDiff !== 0
      ? scoreDiff
      : left.name.localeCompare(right.name, 'es')
  })[0]
}

export function resolvePreferredInvoiceIvaTax(
  document: { documentSubtotal: number; documentIva: number },
  ivaOptions: SiigoTaxOption[],
): SiigoTaxOption | null {
  if (!(document.documentSubtotal > 0) || !(document.documentIva > 0)) {
    return null
  }

  const rate = (document.documentIva / document.documentSubtotal) * 100
  const matches = ivaOptions.filter(
    (tax) =>
      tax.type.trim().toLowerCase() === 'iva' &&
      Math.abs(tax.percentage - rate) < IVA_MATCH_TOLERANCE,
  )

  return pickPreferredIvaTax(matches)
}

export function mergeRetentionTaxOptions(
  ...catalogs: SiigoTaxOption[][]
): SiigoTaxOption[] {
  const taxesById = new Map<number, SiigoTaxOption>()

  for (const catalog of catalogs) {
    for (const tax of catalog) {
      taxesById.set(tax.id, tax)
    }
  }

  return [...taxesById.values()].sort((left, right) =>
    left.name.localeCompare(right.name, 'es'),
  )
}
