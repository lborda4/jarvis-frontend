import type { ElectronicDocumentListItem } from '../types/electronicDocument'
import type { SiigoAccountOption } from '../constants/siigoAccountCatalog'

export function supportDocumentItemAccount(item: NonNullable<ElectronicDocumentListItem['items']>[number]): SiigoAccountOption | null {
  const code = item.accountMapping?.code?.trim() || item.suggestedAccount?.code?.trim()
  return code ? { code, description: item.accountMapping?.description || item.suggestedAccount?.name || code } : null
}

// Solo permite omitir la cuenta general si todas las líneas ya están resueltas.
export function supportDocumentAccountsFallback(document: ElectronicDocumentListItem): SiigoAccountOption | null {
  if (document.electronicDocumentType !== 'SUPPORT_DOCUMENT' || !document.items?.length) return null
  const accounts = document.items.map(supportDocumentItemAccount)
  return accounts.every(Boolean) ? accounts[0] : null
}
