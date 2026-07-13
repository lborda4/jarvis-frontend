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
