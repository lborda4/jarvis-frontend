import type { ElectronicDocumentListItem } from '../types/electronicDocument'

export function isSupplierMissingInSiigo(
  document: ElectronicDocumentListItem,
): boolean {
  return document.supplierExistsInSiigo !== true
}
