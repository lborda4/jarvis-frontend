import type { ImportSession } from '../types/importSession'
import {
  IMPORT_ROW_STATUS,
  type ImportRowStatus,
} from '../types/import'
import type { InvoicePreview } from '../types/invoice'
import {
  isAccountMappingRequiredStatus,
  isAccountMappingResolvedStatus,
  isSupplierNotFoundStatus,
  type AccountMappingStatus,
  type ValidateSiigoImportResponse,
} from '../types/siigo'
import { getApiErrorMessage, requireDocumentId } from './apiClient'
import {
  createSiigoPurchase,
  validateAccountMapping,
  validateSiigoImport,
} from './siigoService'

export interface ImportOrchestratorDeps {
  getSession: (documentId: string) => ImportSession | undefined
  updateSiigoFromResponse: (
    documentId: string,
    response: ValidateSiigoImportResponse,
    stepStatus: ImportRowStatus,
  ) => void
  updateStepStatus: (documentId: string, status: ImportRowStatus) => void
  updateAccountMapping: (
    documentId: string,
    accountCode: string | null,
    autoApply: boolean,
    stepStatus: ImportRowStatus,
  ) => void
}

export type ProcessImportRecordResult =
  | { outcome: 'completed'; status: ImportRowStatus }
  | {
      outcome: 'supplier_not_found'
      documentId: string
      supplierDocument: string
      supplierName: string | null
    }
  | {
      outcome: 'account_mapping_required'
      documentId: string
    }

export type ProcessImportBatchResult =
  | { outcome: 'completed'; lastProcessedIndex: number }
  | {
      outcome: 'supplier_not_found'
      documentId: string
      supplierDocument: string
      supplierName: string | null
      interruptedIndex: number
    }
  | {
      outcome: 'account_mapping_required'
      documentId: string
      interruptedIndex: number
    }

export type AccountMappingStepResult =
  | { outcome: 'completed'; status: ImportRowStatus }
  | { outcome: 'account_mapping_required'; documentId: string }

export function mapAccountMappingStatusToImportRowStatus(
  status: AccountMappingStatus,
): ImportRowStatus {
  if (isAccountMappingRequiredStatus(status)) {
    return IMPORT_ROW_STATUS.REQUIERE_CUENTA
  }

  if (isAccountMappingResolvedStatus(status)) {
    return IMPORT_ROW_STATUS.LISTA
  }

  return IMPORT_ROW_STATUS.ERROR
}

function resolveDocumentId(
  session: ImportSession | undefined,
  preview: InvoicePreview,
): string {
  return requireDocumentId(session?.documentId ?? preview.cufe)
}

export async function createSiigoPurchaseStep(
  documentId: string,
  deps: ImportOrchestratorDeps,
): Promise<ImportRowStatus> {
  deps.updateStepStatus(documentId, IMPORT_ROW_STATUS.EN_PROCESO)

  try {
    await createSiigoPurchase({ documentId })
    deps.updateStepStatus(documentId, IMPORT_ROW_STATUS.LISTA)
    return IMPORT_ROW_STATUS.LISTA
  } catch (error) {
    console.error('[Import] Falló la creación de la factura en SIIGO:', {
      documentId,
      message: getApiErrorMessage(error, 'Error al crear la factura de compra'),
      error,
    })
    deps.updateStepStatus(documentId, IMPORT_ROW_STATUS.ERROR)
    return IMPORT_ROW_STATUS.ERROR
  }
}

export async function proceedToAccountMappingStep(
  documentId: string,
  deps: ImportOrchestratorDeps,
): Promise<AccountMappingStepResult> {
  deps.updateStepStatus(documentId, IMPORT_ROW_STATUS.EN_PROCESO)

  try {
    const accountResponse = await validateAccountMapping({ documentId })

    if (isAccountMappingRequiredStatus(accountResponse.status)) {
      deps.updateAccountMapping(
        documentId,
        accountResponse.accountCode ?? null,
        false,
        IMPORT_ROW_STATUS.REQUIERE_CUENTA,
      )

      return { outcome: 'account_mapping_required', documentId }
    }

    deps.updateAccountMapping(
      documentId,
      accountResponse.accountCode ?? null,
      true,
      IMPORT_ROW_STATUS.EN_PROCESO,
    )

    const purchaseStatus = await createSiigoPurchaseStep(documentId, deps)
    return { outcome: 'completed', status: purchaseStatus }
  } catch (error) {
    console.error('[Import] Falló la validación de cuenta contable:', {
      documentId,
      message: getApiErrorMessage(error, 'Error al validar la cuenta contable'),
      error,
    })
    deps.updateStepStatus(documentId, IMPORT_ROW_STATUS.ERROR)
    return { outcome: 'completed', status: IMPORT_ROW_STATUS.ERROR }
  }
}

export async function processPurchaseImportRecord(
  preview: InvoicePreview,
  deps: ImportOrchestratorDeps,
): Promise<ProcessImportRecordResult> {
  const session = deps.getSession(preview.cufe)
  const rowKey = preview.cufe

  deps.updateStepStatus(rowKey, IMPORT_ROW_STATUS.EN_PROCESO)

  let documentId: string | null = null

  try {
    documentId = resolveDocumentId(session, preview)
    const request = { documentId }

    console.log('[Import] Preparando registro:', {
      documentId,
      sourceType: session?.sourceType ?? '(desconocido)',
      sessionSummary: session?.summary ?? null,
      request,
    })

    const siigoResponse = await validateSiigoImport(request)

    if (isSupplierNotFoundStatus(siigoResponse.status)) {
      deps.updateSiigoFromResponse(
        rowKey,
        siigoResponse,
        IMPORT_ROW_STATUS.REQUIERE_PROVEEDOR,
      )
      deps.updateStepStatus(rowKey, IMPORT_ROW_STATUS.REQUIERE_PROVEEDOR)

      return {
        outcome: 'supplier_not_found',
        documentId,
        supplierDocument: siigoResponse.supplierDocument,
        supplierName: siigoResponse.supplierName,
      }
    }

    deps.updateSiigoFromResponse(
      rowKey,
      siigoResponse,
      IMPORT_ROW_STATUS.EN_PROCESO,
    )

    const accountStep = await proceedToAccountMappingStep(documentId, deps)

    if (accountStep.outcome === 'account_mapping_required') {
      return {
        outcome: 'account_mapping_required',
        documentId,
      }
    }

    return { outcome: 'completed', status: accountStep.status }
  } catch (error) {
    console.error('[Import] Falló el registro:', {
      documentId: documentId ?? '(no definido)',
      message: getApiErrorMessage(error, 'Error desconocido al importar'),
      error,
    })
    deps.updateStepStatus(rowKey, IMPORT_ROW_STATUS.ERROR)
    return { outcome: 'completed', status: IMPORT_ROW_STATUS.ERROR }
  }
}

export async function processPurchaseImportBatch(
  records: InvoicePreview[],
  deps: ImportOrchestratorDeps,
  startIndex = 0,
): Promise<ProcessImportBatchResult> {
  let lastProcessedIndex = startIndex - 1

  for (let index = startIndex; index < records.length; index += 1) {
    const result = await processPurchaseImportRecord(records[index], deps)
    lastProcessedIndex = index

    if (result.outcome === 'supplier_not_found') {
      return {
        ...result,
        interruptedIndex: index,
      }
    }

    if (result.outcome === 'account_mapping_required') {
      return {
        ...result,
        interruptedIndex: index,
      }
    }
  }

  return { outcome: 'completed', lastProcessedIndex }
}

export async function refreshImportStatusAfterSupplierCreated(
  documentId: string,
  deps: ImportOrchestratorDeps,
): Promise<AccountMappingStepResult> {
  return proceedToAccountMappingStep(documentId, deps)
}

export function markAccountSavedBeforePurchase(
  documentId: string,
  accountCode: string,
  autoApply: boolean,
  deps: ImportOrchestratorDeps,
): void {
  deps.updateAccountMapping(
    documentId,
    accountCode,
    autoApply,
    IMPORT_ROW_STATUS.EN_PROCESO,
  )
}

export function markPurchaseCreated(
  documentId: string,
  deps: ImportOrchestratorDeps,
): void {
  deps.updateStepStatus(documentId, IMPORT_ROW_STATUS.LISTA)
}

export function markPurchaseFailed(
  documentId: string,
  deps: ImportOrchestratorDeps,
): void {
  deps.updateStepStatus(documentId, IMPORT_ROW_STATUS.ERROR)
}
