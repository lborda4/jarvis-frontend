import type { SiigoProductOption } from '../constants/siigoProductCatalog'
import type { SiigoProductCatalogItem } from '../types/siigo'

export function mapCatalogItemToProductOption(
  item: SiigoProductCatalogItem,
): SiigoProductOption {
  return {
    code: item.code,
    description: item.name,
  }
}

export function mapCatalogToProductOptions(
  items: SiigoProductCatalogItem[],
): SiigoProductOption[] {
  return items.map(mapCatalogItemToProductOption)
}
