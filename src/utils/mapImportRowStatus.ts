import {
  ELECTRONIC_DOCUMENT_STATUS,
  type ElectronicDocumentListItem,
  type ResumeNextStep,
} from '../types/electronicDocument'
import {
  IMPORT_ROW_STATUS,
  type ImportRowStatus,
} from '../types/import'
import { isSupplierCheckPending, isSupplierMissingInSiigo } from './supplierSiigoStatus'

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
  if (
    document.status === ELECTRONIC_DOCUMENT_STATUS.PURCHASE_CREATED ||
    document.status === ELECTRONIC_DOCUMENT_STATUS.COMPLETED
  ) {
    return document.alreadyInSiigo
      ? IMPORT_ROW_STATUS.EXISTENTE_EN_SIIGO
      : IMPORT_ROW_STATUS.LISTA
  }

  if (
    document.status === ELECTRONIC_DOCUMENT_STATUS.PURCHASE_FAILED ||
    document.status === ELECTRONIC_DOCUMENT_STATUS.FAILED
  ) {
    return IMPORT_ROW_STATUS.ERROR
  }

  if (isSupplierCheckPending(document)) {
    return IMPORT_ROW_STATUS.EN_PROCESO
  }

  if (isSupplierMissingInSiigo(document)) {
    return IMPORT_ROW_STATUS.REQUIERE_PROVEEDOR
  }

  return IMPORT_ROW_STATUS.PENDIENTE
}

export function getSupportDocumentActionFromImportStatus(
  importStatus: ImportRowStatus,
): 'supplier_missing' | 'processing' | 'send' | 'delete' | 'none' | 'empty' {
  switch (importStatus) {
    case IMPORT_ROW_STATUS.REQUIERE_PROVEEDOR:
      return 'supplier_missing'
    case IMPORT_ROW_STATUS.EN_PROCESO:
      return 'processing'
    case IMPORT_ROW_STATUS.LISTA:
    case IMPORT_ROW_STATUS.ERROR:
      return 'delete'
    // Ya existía en SIIGO antes de este import (no la creamos nosotros), así
    // que no debe poder borrarse ni de la BD ni de SIIGO (ver
    // isDocumentRemovableFromDatabase / isDocumentDeletableFromSiigo en
    // supportDocumentSend.ts, que ya la excluyen a propósito) — la celda de
    // acción queda vacía en vez de mostrar un botón de eliminar inválido.
    case IMPORT_ROW_STATUS.EXISTENTE_EN_SIIGO:
      return 'empty'
    default:
      return 'send'
  }
}

export function isSupportDocumentRowSelectable(
  importStatus: ImportRowStatus,
): boolean {
  return importStatus !== IMPORT_ROW_STATUS.EN_PROCESO
}
