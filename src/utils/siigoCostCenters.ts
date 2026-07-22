import type { SiigoCostCenterOption } from '../constants/siigoCostCenterCatalog'
import {
  NONE_COST_CENTER_OPTION,
  isNoneCostCenterOption,
} from '../constants/siigoCostCenterCatalog'
import type { SiigoCostCenterCatalogItem } from '../types/siigo'

export function mapCatalogItemToCostCenterOption(
  item: SiigoCostCenterCatalogItem,
): SiigoCostCenterOption {
  return {
    id: item.id,
    code: item.code,
    name: item.name,
  }
}

export function mapSuggestedCostCenterToOption(
  costCenter: {
    id: number
    code: string
    name: string
  } | null | undefined,
): SiigoCostCenterOption {
  if (!costCenter?.id || isNoneCostCenterOption(costCenter)) {
    return NONE_COST_CENTER_OPTION
  }

  return {
    id: costCenter.id,
    code: costCenter.code,
    name: costCenter.name,
  }
}

export function mapCatalogToCostCenterOptions(
  items: SiigoCostCenterCatalogItem[],
): SiigoCostCenterOption[] {
  return items.map(mapCatalogItemToCostCenterOption)
}
