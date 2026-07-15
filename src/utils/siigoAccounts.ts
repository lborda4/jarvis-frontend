import type { SiigoAccountOption } from '../constants/siigoAccountCatalog'
import type {
  ElectronicDocumentListItem,
  SuggestedAccount,
} from '../types/electronicDocument'
import type { SiigoAccountCatalogItem } from '../types/siigo'

type SuggestedAccountLike = {
  code?: string | null
  accountCode?: string | null
  name?: string | null
  accountDescription?: string | null
  description?: string | null
}

function normalizeAccountLabel(value: string): string {
  return value.trim().toLowerCase()
}

function findAccountInCatalog(
  catalog: SiigoAccountOption[],
  code?: string,
  description?: string,
): SiigoAccountOption | null {
  if (code) {
    const byCode = catalog.find((item) => item.code === code)
    if (byCode) {
      return byCode
    }
  }

  if (!description) {
    return null
  }

  const normalizedDescription = normalizeAccountLabel(description)

  return (
    catalog.find((item) => {
      const itemDescription = normalizeAccountLabel(item.description)
      const itemLabel = normalizeAccountLabel(`${item.code} - ${item.description}`)

      return (
        itemDescription === normalizedDescription || itemLabel === normalizedDescription
      )
    }) ?? null
  )
}

export function resolveSuggestedAccountOption(
  suggestedAccount: SuggestedAccountLike | null | undefined,
  catalog: SiigoAccountOption[] = [],
): SiigoAccountOption | null {
  if (!suggestedAccount) {
    return null
  }

  let code =
    suggestedAccount.code?.trim() || suggestedAccount.accountCode?.trim() || ''
  let description =
    suggestedAccount.name?.trim() ||
    suggestedAccount.accountDescription?.trim() ||
    suggestedAccount.description?.trim() ||
    ''

  if (!code && description) {
    const labeledMatch = description.match(/^(\d+)\s*-\s*(.+)$/)

    if (labeledMatch) {
      code = labeledMatch[1]
      description = labeledMatch[2].trim()
    }
  }

  const catalogMatch = findAccountInCatalog(
    catalog,
    code || undefined,
    description || undefined,
  )

  if (catalogMatch) {
    return catalogMatch
  }

  if (code) {
    return {
      code,
      description: description || code,
    }
  }

  return null
}

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
  catalog: SiigoAccountOption[] = [],
): SiigoAccountOption | null {
  return resolveSuggestedAccountOption(
    suggestedAccount as SuggestedAccountLike | null | undefined,
    catalog,
  )
}

export function buildInitialRowAccounts(
  documents: ElectronicDocumentListItem[],
  catalog: SiigoAccountOption[] = [],
): Record<string, SiigoAccountOption | null> {
  return Object.fromEntries(
    documents.map((document) => [
      document.id,
      resolveSuggestedAccountOption(document.suggestedAccount, catalog),
    ]),
  )
}

export function mergeSuggestedAccountsIntoOptions(
  options: SiigoAccountOption[],
  documents: ElectronicDocumentListItem[],
): SiigoAccountOption[] {
  const accountsByCode = new Map(options.map((option) => [option.code, option]))

  for (const document of documents) {
    const suggested = resolveSuggestedAccountOption(
      document.suggestedAccount,
      options,
    )

    if (suggested && !accountsByCode.has(suggested.code)) {
      accountsByCode.set(suggested.code, suggested)
    }
  }

  return [...accountsByCode.values()].sort((left, right) =>
    left.code.localeCompare(right.code),
  )
}
