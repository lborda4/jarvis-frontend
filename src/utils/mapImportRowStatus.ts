import {
  ELECTRONIC_DOCUMENT_STATUS,
  type ElectronicDocumentListItem,
  type ResumeNextStep,
} from '../types/electronicDocument'
import {
  IMPORT_ROW_STATUS,
  type ImportRowStatus,
} from '../types/import'
import { isSupplierMissingInSiigo } from './supplierSiigoStatus'

export function mapResumeNextStepToImportStatus(
  nextStep: ResumeNextStep,
): ImportRowStatus {
  switch (nextStep) {
    case 'SUPPLIER_REQUIRED':
      return IMPORT_ROW_STATUS.REQUIERE_PROVEEDOR
    case 'ACCOUNT_REQUIRED':
      return IMPORT_ROW_STATUS.PENDIENTE
    case 'COMPLETED':
      return IMPORT_ROW_STATUS.LISTA
    case 'FAILED':
      return IMPORT_ROW_STATUS.ERROR
    default:
      return IMPORT_ROW_STATUS.ERROR
  }
}

export function mapDocumentToImportRowStatus(
  document: ElectronicDocumentListItem,
): ImportRowStatus {
  if (isSupplierMissingInSiigo(document)) {
    return IMPORT_ROW_STATUS.REQUIERE_PROVEEDOR
  }

  if (
    document.status === ELECTRONIC_DOCUMENT_STATUS.PURCHASE_CREATED ||
    document.status === ELECTRONIC_DOCUMENT_STATUS.COMPLETED
  ) {
    return IMPORT_ROW_STATUS.LISTA
  }

  if (
    document.status === ELECTRONIC_DOCUMENT_STATUS.PURCHASE_FAILED ||
    document.status === ELECTRONIC_DOCUMENT_STATUS.FAILED
  ) {
    return IMPORT_ROW_STATUS.ERROR
  }

  return IMPORT_ROW_STATUS.PENDIENTE
}

export function getSupportDocumentActionFromImportStatus(
  importStatus: ImportRowStatus,
): 'supplier_missing' | 'send' | 'none' {
  switch (importStatus) {
    case IMPORT_ROW_STATUS.REQUIERE_PROVEEDOR:
      return 'supplier_missing'
    case IMPORT_ROW_STATUS.LISTA:
      return 'none'
    default:
      return 'send'
  }
}
