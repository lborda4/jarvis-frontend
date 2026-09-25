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

/** La clasificación automática publica primero el tipo (Cuenta/Producto) y
 * unos segundos después el código. Mientras no haya cuenta, producto ni
 * confianza, el listado tiene que seguir refrescándose: si el sondeo para
 * cuando el proveedor ya está validado, el código nunca llega a la pantalla. */
export function isPurchaseAiClassificationPending(
  document: ElectronicDocumentListItem,
): boolean {
  if (
    document.electronicDocumentType &&
    document.electronicDocumentType !== 'PURCHASE_INVOICE'
  ) {
    return false
  }

  if (document.aiConfidence != null) {
    return false
  }

  if (
    document.suggestedAccount?.code?.trim() ||
    document.suggestedProduct?.code?.trim() ||
    document.suggestedItemConfig?.accountCode?.trim() ||
    document.suggestedItemConfig?.productCode?.trim()
  ) {
    return false
  }

  if (
    document.items?.some(
      (item) =>
        item.suggestedAccount?.source === 'exact' &&
        Boolean(item.suggestedAccount.code?.trim()),
    )
  ) {
    return false
  }

  return true
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
    // Ya se envió y SIIGO confirmó — no debe poder borrarse desde acá (ver
    // isDocumentDeletableFromSiigo en supportDocumentSend.ts, que ya no la
    // incluye), así que la celda de acción muestra "Completado" en vez de un
    // botón de eliminar.
    case IMPORT_ROW_STATUS.LISTA:
      return 'none'
    // Ya existía en SIIGO antes de este import (no la creamos nosotros), así
    // que no debe poder borrarse ni de la BD ni de SIIGO (ver
    // isDocumentRemovableFromDatabase / isDocumentDeletableFromSiigo en
    // supportDocumentSend.ts, que ya la excluyen a propósito) — la celda de
    // acción queda vacía en vez de mostrar un botón de eliminar inválido.
    case IMPORT_ROW_STATUS.EXISTENTE_EN_SIIGO:
      return 'empty'
    // ERROR (falló el envío) cae al 'send' por defecto: el usuario reintenta
    // desde el mismo botón en vez de solo poder eliminar el documento — caso
    // real reportado: un documento soporte que quedó en error no tenía
    // ninguna forma de reintentarlo desde la tabla.
    default:
      return 'send'
  }
}

export function isSupportDocumentRowSelectable(
  importStatus: ImportRowStatus,
): boolean {
  return importStatus !== IMPORT_ROW_STATUS.EN_PROCESO
}
