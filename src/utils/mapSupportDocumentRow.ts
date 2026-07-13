import type { ElectronicDocumentListItem } from '../types/electronicDocument'
import type {
  SupportDocumentAction,
  SupportDocumentRow,
} from '../types/supportDocumentPage'
import type { ImportRowStatus } from '../types/import'
import {
  getDocumentInvoiceNumber,
  getDocumentSupplierName,
} from './electronicDocumentDisplay'
import {
  getSupportDocumentActionFromImportStatus,
  mapDocumentToImportRowStatus,
} from './mapImportRowStatus'
import { isSupplierMissingInSiigo } from './supplierSiigoStatus'

export function mapElectronicDocumentToSupportRow(
  document: ElectronicDocumentListItem,
  importStatusOverride?: ImportRowStatus,
): SupportDocumentRow {
  const importStatus =
    importStatusOverride ?? mapDocumentToImportRowStatus(document)
  const supplierMissing = isSupplierMissingInSiigo(document)
  const action: SupportDocumentAction =
    getSupportDocumentActionFromImportStatus(importStatus)

  return {
    id: document.id,
    supplierName: getDocumentSupplierName(document),
    supplierNit: document.supplierNit?.trim() || '—',
    documentCode: getDocumentInvoiceNumber(document),
    supplierExistsInSiigo: !supplierMissing,
    suggestedAccount: document.suggestedAccount ?? null,
    importStatus,
    action,
  }
}
