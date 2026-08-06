import type { SiigoAccountOption } from '../constants/siigoAccountCatalog'
import type { SiigoPaymentMethodOption } from '../constants/siigoPaymentMethodCatalog'
import type { ElectronicDocumentListItem } from '../types/electronicDocument'
import { IMPORT_ROW_STATUS, type ImportRowStatus } from '../types/import'
import { isSupplierCheckPending, isSupplierMissingInSiigo } from './supplierSiigoStatus'

export function isDocumentReadyToSend(
  documentId: string,
  rowAccounts: Record<string, SiigoAccountOption | null>,
  rowPaymentMethods: Record<string, SiigoPaymentMethodOption | null>,
  options?: {
    requiresAccount?: boolean
    requiresPaymentMethod?: boolean
  },
): boolean {
  const requiresAccount = options?.requiresAccount ?? true
  const requiresPaymentMethod = options?.requiresPaymentMethod ?? true

  if (requiresAccount && !rowAccounts[documentId]) {
    return false
  }

  if (requiresPaymentMethod && !rowPaymentMethods[documentId]) {
    return false
  }

  return true
}

export function canSendDocument(
  document: ElectronicDocumentListItem,
  documentId: string,
  importStatus: ImportRowStatus | undefined,
  rowAccounts: Record<string, SiigoAccountOption | null>,
  rowPaymentMethods: Record<string, SiigoPaymentMethodOption | null>,
  options?: {
    requiresAccount?: boolean
    requiresPaymentMethod?: boolean
  },
): boolean {
  if (isSupplierMissingInSiigo(document) || isSupplierCheckPending(document)) {
    return false
  }

  if (
    importStatus === IMPORT_ROW_STATUS.LISTA ||
    importStatus === IMPORT_ROW_STATUS.EN_PROCESO
  ) {
    return false
  }

  return isDocumentReadyToSend(
    documentId,
    rowAccounts,
    rowPaymentMethods,
    options,
  )
}

export function countSendableDocuments(
  documentIds: Iterable<string>,
  documentsById: Record<string, ElectronicDocumentListItem>,
  importStatuses: Record<string, ImportRowStatus>,
  rowAccounts: Record<string, SiigoAccountOption | null>,
  rowPaymentMethods: Record<string, SiigoPaymentMethodOption | null>,
  options?: {
    requiresAccount?: boolean
    requiresPaymentMethod?: boolean
  },
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
        options,
      )
    ) {
      count += 1
    }
  }

  return count
}

export function countDeletableDocuments(
  documentIds: Iterable<string>,
  importStatuses: Record<string, ImportRowStatus>,
): number {
  let count = 0

  for (const documentId of documentIds) {
    if (importStatuses[documentId] === IMPORT_ROW_STATUS.LISTA) {
      count += 1
    }
  }

  return count
}
