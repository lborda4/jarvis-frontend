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
import { isSupplierReadyInSiigo } from './supplierSiigoStatus'

export function mapElectronicDocumentToSupportRow(
  document: ElectronicDocumentListItem,
  importStatusOverride?: ImportRowStatus,
): SupportDocumentRow {
  const importStatus =
    importStatusOverride ?? mapDocumentToImportRowStatus(document)
  const supplierReady = isSupplierReadyInSiigo(document)
  const action: SupportDocumentAction =
    getSupportDocumentActionFromImportStatus(importStatus)

  return {
    id: document.id,
    supplierName: getDocumentSupplierName(document),
    supplierNit: document.supplierNit?.trim() || '—',
    documentCode: getDocumentInvoiceNumber(document),
    siigoDocumentNumber: document.siigoDocumentNumber ?? null,
    supplierExistsInSiigo: supplierReady,
    suggestedAccount: document.suggestedAccount ?? null,
    importStatus,
    action,
    createdAt: document.createdAt,
  }
}
