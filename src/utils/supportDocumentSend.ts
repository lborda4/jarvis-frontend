import type { SiigoAccountOption } from '../constants/siigoAccountCatalog'
import type { SiigoPaymentMethodOption } from '../constants/siigoPaymentMethodCatalog'
import type { ElectronicDocumentListItem } from '../types/electronicDocument'
import { IMPORT_ROW_STATUS, type ImportRowStatus } from '../types/import'
import { isSupplierMissingInSiigo } from './supplierSiigoStatus'

export function isDocumentReadyToSend(
  documentId: string,
  rowAccounts: Record<string, SiigoAccountOption | null>,
  rowPaymentMethods: Record<string, SiigoPaymentMethodOption | null>,
  retentionsConfiguredIds: Set<string>,
): boolean {
  return Boolean(
    rowAccounts[documentId] &&
      rowPaymentMethods[documentId] &&
      retentionsConfiguredIds.has(documentId),
  )
}

export function canSendDocument(
  document: ElectronicDocumentListItem,
  documentId: string,
  importStatus: ImportRowStatus | undefined,
  rowAccounts: Record<string, SiigoAccountOption | null>,
  rowPaymentMethods: Record<string, SiigoPaymentMethodOption | null>,
  retentionsConfiguredIds: Set<string>,
): boolean {
  if (isSupplierMissingInSiigo(document)) {
    return false
  }

  if (importStatus === IMPORT_ROW_STATUS.LISTA) {
    return false
  }

  return isDocumentReadyToSend(
    documentId,
    rowAccounts,
    rowPaymentMethods,
    retentionsConfiguredIds,
  )
}

export function countSendableDocuments(
  documentIds: Iterable<string>,
  documentsById: Record<string, ElectronicDocumentListItem>,
  importStatuses: Record<string, ImportRowStatus>,
  rowAccounts: Record<string, SiigoAccountOption | null>,
  rowPaymentMethods: Record<string, SiigoPaymentMethodOption | null>,
  retentionsConfiguredIds: Set<string>,
): number {
  let count = 0

  for (const documentId of documentIds) {
    const document = documentsById[documentId]

    if (
      document &&
      canSendDocument(
        document,
        documentId,
        importStatuses[documentId],
        rowAccounts,
        rowPaymentMethods,
        retentionsConfiguredIds,
      )
    ) {
      count += 1
    }
  }

  return count
}
