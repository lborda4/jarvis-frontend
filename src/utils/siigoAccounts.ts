import type { SiigoAccountOption } from '../constants/siigoAccountCatalog'
import type { SuggestedAccount, ElectronicDocumentListItem } from '../types/electronicDocument'
import type { SiigoAccountCatalogItem } from '../types/siigo'

export function mapCatalogItemToAccountOption(
  item: SiigoAccountCatalogItem,
): SiigoAccountOption {
  return {
    code: item.code,
    description: item.name,
  }
}

export function mapCatalogToAccountOptions(
  items: SiigoAccountCatalogItem[],
): SiigoAccountOption[] {
  return items.map(mapCatalogItemToAccountOption)
}

export function mapSuggestedAccountToOption(
  suggestedAccount: SuggestedAccount | null | undefined,
): SiigoAccountOption | null {
  if (!suggestedAccount?.code?.trim()) {
    return null
  }

  return {
    code: suggestedAccount.code.trim(),
    description: suggestedAccount.name?.trim() || suggestedAccount.code.trim(),
  }
}

export function mergeSuggestedAccountsIntoOptions(
  options: SiigoAccountOption[],
  documents: ElectronicDocumentListItem[],
): SiigoAccountOption[] {
  const accountsByCode = new Map(options.map((option) => [option.code, option]))

  for (const document of documents) {
    const suggested = mapSuggestedAccountToOption(document.suggestedAccount)

    if (suggested && !accountsByCode.has(suggested.code)) {
      accountsByCode.set(suggested.code, suggested)
    }
  }

  return [...accountsByCode.values()].sort((left, right) =>
    left.code.localeCompare(right.code),
  )
}
