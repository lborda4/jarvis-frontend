import type { ElectronicDocumentListItem } from '../types/electronicDocument'
import { ELECTRONIC_DOCUMENT_STATUS } from '../types/electronicDocument'

export function isSupplierCheckPending(
  document: ElectronicDocumentListItem,
): boolean {
  if (
    document.supplierExistsInSiigo === true ||
    document.supplierExistsInSiigo === false
  ) {
    return false
  }

  if (
    document.status === ELECTRONIC_DOCUMENT_STATUS.SUPPLIER_NOT_FOUND ||
    document.status === ELECTRONIC_DOCUMENT_STATUS.PURCHASE_CREATED ||
    document.status === ELECTRONIC_DOCUMENT_STATUS.COMPLETED
  ) {
    return false
  }

  return true
}

export function isSupplierMissingInSiigo(
  document: ElectronicDocumentListItem,
): boolean {
  if (document.supplierExistsInSiigo === false) {
    return true
  }

  return document.status === ELECTRONIC_DOCUMENT_STATUS.SUPPLIER_NOT_FOUND
}

export function isSupplierReadyInSiigo(
  document: ElectronicDocumentListItem,
): boolean {
  return document.supplierExistsInSiigo === true
}
