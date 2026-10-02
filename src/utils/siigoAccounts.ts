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

  // Catálogo ya cargado y el código/nombre no matchean ninguna cuenta usable
  // (padre, borrada, producto colado como cuenta, etc.): NO inventar una
  // opción sintética. Eso era el bug de prod — la UI mostraba la "cuenta",
  // el envío iba con ese código y SIIGO respondía que no existe; al
  // reelegir del picker sí iba el código hoja real.
  if (catalog.length > 0) {
    return null
  }

  // Catálogo todavía vacío (carga en curso): se deja provisional para no
  // vaciar la fila; el efecto de rematch la valida cuando llegue el catálogo.
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
  current: Record<string, SiigoAccountOption | null> = {},
): Record<string, SiigoAccountOption | null> {
  return Object.fromEntries(
    documents.map((document) => [
      document.id,
      current[document.id] !== undefined
        ? current[document.id]
        : resolveSuggestedAccountOption(document.suggestedAccount, catalog),
    ]),
  )
}

/**
 * Rematch de cuentas precargadas contra el catálogo usable. Corrige el caso
 * en que la fila quedó con un código sintético (historial/IA / catálogo aún
 * vacío) que SIIGO rechaza al enviar.
 */
export function rematchRowAccountsToCatalog(
  documents: ElectronicDocumentListItem[],
  catalog: SiigoAccountOption[],
  current: Record<string, SiigoAccountOption | null>,
  resolveSuggestion: (
    document: ElectronicDocumentListItem,
  ) => SuggestedAccountLike | null | undefined,
): Record<string, SiigoAccountOption | null> {
  if (catalog.length === 0) {
    return current
  }

  let changed = false
  const next = { ...current }

  for (const document of documents) {
    const existing = next[document.id]

    if (existing?.code) {
      const catalogMatch = findAccountInCatalog(
        catalog,
        existing.code,
        existing.description,
      )

      if (catalogMatch) {
        if (
          catalogMatch.code !== existing.code ||
          catalogMatch.description !== existing.description
        ) {
          next[document.id] = catalogMatch
          changed = true
        }
        continue
      }

      next[document.id] = null
      changed = true
    }

    if (next[document.id]) {
      continue
    }

    const suggested = resolveSuggestedAccountOption(
      resolveSuggestion(document),
      catalog,
    )

    if (suggested) {
      next[document.id] = suggested
      changed = true
    }
  }

  return changed ? next : current
}

export function mergeSuggestedAccountsIntoOptions(
  options: SiigoAccountOption[],
  _documents: ElectronicDocumentListItem[],
): SiigoAccountOption[] {
  // Solo el catálogo real del picker. Antes se inyectaban códigos de
  // historial/IA fuera del plan usable y el contador podía "elegir" (o
  // reelegir) esa misma opción inválida.
  return options
}
