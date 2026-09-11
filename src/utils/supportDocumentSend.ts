import type { SiigoAccountOption } from '../constants/siigoAccountCatalog'
import type { SiigoPaymentMethodOption } from '../constants/siigoPaymentMethodCatalog'
import type { ElectronicDocumentListItem } from '../types/electronicDocument'
import type { PurchaseInvoiceItemDraft } from '../types/purchaseInvoiceItemDraft'
import {
  hasEmptyItemDescription,
  hasUnresolvedProductItem,
} from '../types/purchaseInvoiceItemDraft'
import { IMPORT_ROW_STATUS, type ImportRowStatus } from '../types/import'
import { isCreditPaymentMethod } from './siigoPaymentMethods'
import { isSupplierCheckPending, isSupplierMissingInSiigo } from './supplierSiigoStatus'

/** Un ítem tipo 'Account'/'FixedAsset' con su propio código (`producto`) ya
 * llenado trae la cuenta/activo que necesita ('Product' se valida aparte,
 * ver hasUnresolvedProductItem). rowAccounts[documentId] (la cuenta a nivel
 * de documento) solo se usa como fallback cuando NO hay ítems editados
 * (ver buildSiigoPurchaseSendRequest en buildSiigoDocumentRequest.ts: `code:
 * isAccountItem ? editedCode || account.code : editedCode`) — apenas hay
 * ítems, cada uno debe traer su propio código sin excepción: dejarlo en
 * blanco ya NO cae calladamente a la cuenta del documento (bug real
 * reportado: el contador borraba el código del ítem para corregirlo y
 * "Enviar" seguía habilitado porque una cuenta vieja seguía puesta a nivel
 * de documento, invisible en este editor). */
function itemsSatisfyAccountRequirement(
  items: PurchaseInvoiceItemDraft[] | undefined,
): boolean {
  if (!items || items.length === 0) {
    return false
  }

  return items.every((item) =>
    item.tipo === 'Product' ? true : item.producto.trim().length > 0,
  )
}

export function isDocumentReadyToSend(
  documentId: string,
  rowAccounts: Record<string, SiigoAccountOption | null>,
  rowPaymentMethods: Record<string, SiigoPaymentMethodOption | null>,
  rowDueDates: Record<string, string | null>,
  rowItems?: Record<string, PurchaseInvoiceItemDraft[]>,
  options?: {
    requiresAccount?: boolean
    requiresPaymentMethod?: boolean
  },
): boolean {
  // Un ítem Producto sin código bloquea el envío SIEMPRE, tenga o no
  // asignada una cuenta contable a nivel de documento — a diferencia de un
  // ítem Cuenta vacío, no existe un "producto por defecto" al que caer.
  if (hasUnresolvedProductItem(rowItems?.[documentId])) {
    return false
  }

  // Una descripción vacía en cualquier ítem bloquea el envío igual que un
  // código vacío — no hay un texto por defecto al que caer.
  if (hasEmptyItemDescription(rowItems?.[documentId])) {
    return false
  }

  const requiresAccount = options?.requiresAccount ?? true
  const requiresPaymentMethod = options?.requiresPaymentMethod ?? true
  const paymentMethod = rowPaymentMethods[documentId]
  const items = rowItems?.[documentId]
  const hasItems = Boolean(items && items.length > 0)

  if (requiresAccount) {
    // Con ítems editados, la cuenta a nivel de documento deja de contar como
    // fallback válido (ver itemsSatisfyAccountRequirement) — sin ítems, sigue
    // siendo la única fuente posible.
    if (hasItems ? !itemsSatisfyAccountRequirement(items) : !rowAccounts[documentId]) {
      return false
    }
  }

  if (requiresPaymentMethod && !paymentMethod) {
    return false
  }

  // Crédito exige plazo o fecha de vencimiento antes de poder enviar.
  if (isCreditPaymentMethod(paymentMethod) && !rowDueDates[documentId]?.trim()) {
    return false
  }

  return true
}

/** Explica por qué canSendDocument rechazaría este documento — misma lógica
 * y mismo orden de chequeo, para que un envío masivo pueda decirle al
 * usuario POR QUÉ se omitió un documento en vez de simplemente desaparecerlo
 * del conteo (bug real: seleccionar 5 y ver "0 de 3" sin ninguna indicación
 * de qué pasó con los otros 2). Devuelve null si el documento SÍ se puede
 * enviar. */
export function buildNotSendableReason(
  document: ElectronicDocumentListItem,
  documentId: string,
  importStatus: ImportRowStatus | undefined,
  rowAccounts: Record<string, SiigoAccountOption | null>,
  rowPaymentMethods: Record<string, SiigoPaymentMethodOption | null>,
  rowDueDates: Record<string, string | null>,
  rowItems?: Record<string, PurchaseInvoiceItemDraft[]>,
  options?: {
    requiresAccount?: boolean
    requiresPaymentMethod?: boolean
  },
): string | null {
  if (isSupplierMissingInSiigo(document)) {
    return 'El proveedor no existe en SIIGO todavía.'
  }

  if (isSupplierCheckPending(document)) {
    return 'Todavía se está validando el proveedor en SIIGO.'
  }

  if (importStatus === IMPORT_ROW_STATUS.LISTA) {
    return 'El documento ya fue enviado.'
  }

  if (importStatus === IMPORT_ROW_STATUS.EXISTENTE_EN_SIIGO) {
    return 'La factura ya existe en SIIGO.'
  }

  if (importStatus === IMPORT_ROW_STATUS.EN_PROCESO) {
    return 'El documento ya se está enviando.'
  }

  if (hasUnresolvedProductItem(rowItems?.[documentId])) {
    return 'Hay un ítem de producto sin código asignado — requiere revisión.'
  }

  if (hasEmptyItemDescription(rowItems?.[documentId])) {
    return 'Falta la descripción de un ítem.'
  }

  const requiresAccount = options?.requiresAccount ?? true
  const requiresPaymentMethod = options?.requiresPaymentMethod ?? true
  const paymentMethod = rowPaymentMethods[documentId]
  const items = rowItems?.[documentId]
  const hasItems = Boolean(items && items.length > 0)

  if (
    requiresAccount &&
    (hasItems ? !itemsSatisfyAccountRequirement(items) : !rowAccounts[documentId])
  ) {
    return 'Falta asignar la cuenta contable.'
  }

  if (requiresPaymentMethod && !paymentMethod) {
    return 'Falta asignar el medio de pago.'
  }

  if (isCreditPaymentMethod(paymentMethod) && !rowDueDates[documentId]?.trim()) {
    return 'El medio de pago es a crédito y falta la fecha de vencimiento.'
  }

  return null
}

export function canSendDocument(
  document: ElectronicDocumentListItem,
  documentId: string,
  importStatus: ImportRowStatus | undefined,
  rowAccounts: Record<string, SiigoAccountOption | null>,
  rowPaymentMethods: Record<string, SiigoPaymentMethodOption | null>,
  rowDueDates: Record<string, string | null>,
  rowItems?: Record<string, PurchaseInvoiceItemDraft[]>,
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
    importStatus === IMPORT_ROW_STATUS.EXISTENTE_EN_SIIGO ||
    importStatus === IMPORT_ROW_STATUS.EN_PROCESO
  ) {
    return false
  }

  return isDocumentReadyToSend(
    documentId,
    rowAccounts,
    rowPaymentMethods,
    rowDueDates,
    rowItems,
    options,
  )
}

export function countSendableDocuments(
  documentIds: Iterable<string>,
  documentsById: Record<string, ElectronicDocumentListItem>,
  importStatuses: Record<string, ImportRowStatus>,
  rowAccounts: Record<string, SiigoAccountOption | null>,
  rowPaymentMethods: Record<string, SiigoPaymentMethodOption | null>,
  rowDueDates: Record<string, string | null>,
  rowItems?: Record<string, PurchaseInvoiceItemDraft[]>,
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
        rowDueDates,
        rowItems,
        options,
      )
    ) {
      count += 1
    }
  }

  return count
}

/** Registros aún no enviados desde acá (no LISTA / no EN PROCESO / no
 * EXISTENTE EN SIIGO): se pueden borrar de la BD. EXISTENTE EN SIIGO queda
 * afuera a propósito — esa factura ya existía en SIIGO antes de este import
 * (no la creamos nosotros), así que no debe poder borrarse ni de la BD ni de
 * SIIGO (ver isDocumentDeletableFromSiigo, que tampoco la incluye). */
export function isDocumentRemovableFromDatabase(
  importStatus: ImportRowStatus | undefined,
): boolean {
  if (!importStatus) {
    return false
  }

  return (
    importStatus !== IMPORT_ROW_STATUS.LISTA &&
    importStatus !== IMPORT_ROW_STATUS.EN_PROCESO &&
    importStatus !== IMPORT_ROW_STATUS.EXISTENTE_EN_SIIGO
  )
}

/** LISTA en Siigo: se elimina en SIIGO y se revierte el estado local. */
export function isDocumentDeletableFromSiigo(
  importStatus: ImportRowStatus | undefined,
  provider: 'SIIGO' | 'JARVIS',
): boolean {
  return (
    provider === 'SIIGO' && importStatus === IMPORT_ROW_STATUS.LISTA
  )
}

export function isDocumentDeletable(
  importStatus: ImportRowStatus | undefined,
  provider: 'SIIGO' | 'JARVIS',
): boolean {
  return (
    isDocumentRemovableFromDatabase(importStatus) ||
    isDocumentDeletableFromSiigo(importStatus, provider)
  )
}

export function countDeletableDocuments(
  documentIds: Iterable<string>,
  importStatuses: Record<string, ImportRowStatus>,
  provider: 'SIIGO' | 'JARVIS' = 'SIIGO',
): number {
  let count = 0

  for (const documentId of documentIds) {
    if (isDocumentDeletable(importStatuses[documentId], provider)) {
      count += 1
    }
  }

  return count
}
