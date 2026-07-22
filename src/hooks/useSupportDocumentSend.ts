import { useCallback, useState } from 'react'
import {
  AUTO_DISMISS_ERROR_MS,
  useAutoDismissMessage,
} from './useAutoDismissMessage'
import type { SiigoAccountOption } from '../constants/siigoAccountCatalog'
import type { SiigoCostCenterOption } from '../constants/siigoCostCenterCatalog'
import type { SiigoPaymentMethodOption } from '../constants/siigoPaymentMethodCatalog'
import type { SiigoTaxOption } from '../constants/siigoTaxCatalog'
import { getApiErrorMessage } from '../services/apiClient'
import type { ElectronicDocumentListItem } from '../types/electronicDocument'
import { IMPORT_ROW_STATUS, type ImportRowStatus } from '../types/import'
import type { DocumentWorkspaceConfig } from '../constants/documentWorkspaceConfig'
import type { SiigoDocumentSendRequest } from '../utils/buildSiigoDocumentRequest'
import { canSendDocument } from '../utils/supportDocumentSend'
import { isSiigoDuplicatedDocumentError } from '../utils/siigoSendErrors'

const SEND_INTERVAL_MS = 1000
const DUPLICATE_RETRY_PAUSE_MS = 2000
const DUPLICATE_RETRY_INTERVAL_MS = 2000
const MAX_DUPLICATE_RETRY_ROUNDS = 3

interface SendDocumentsParams {
  documentIds: string[]
  documentsById: Record<string, ElectronicDocumentListItem>
  importStatuses: Record<string, ImportRowStatus>
  rowAccounts: Record<string, SiigoAccountOption | null>
  rowPaymentMethods: Record<string, SiigoPaymentMethodOption | null>
  rowCostCenters: Record<string, SiigoCostCenterOption | null>
  rowRetentions: Record<string, SiigoTaxOption[]>
  rowDates: Record<string, string>
  rowObservations: Record<string, string>
  retentionsConfiguredIds: Set<string>
  savePreferences?: boolean
}

interface UseSupportDocumentSendOptions {
  workspace: Pick<
    DocumentWorkspaceConfig,
    'buildSendRequest' | 'sendToSiigo' | 'sendSuccessFeedback'
  >
  onCompleted: () => void
  onDocumentStatusChange?: (
    documentId: string,
    status: ImportRowStatus,
  ) => void
}

interface SendAttemptResult {
  documentId: string
  success: boolean
  error?: string
  isDuplicated: boolean
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

export function useSupportDocumentSend({
  workspace,
  onCompleted,
  onDocumentStatusChange,
}: UseSupportDocumentSendOptions) {
  const [isSending, setIsSending] = useState(false)
  const [feedbackMessage, setFeedbackMessage] = useAutoDismissMessage()
  const [errorMessage, setErrorMessage] = useAutoDismissMessage(
    AUTO_DISMISS_ERROR_MS,
  )

  const sendDocuments = useCallback(
    async (params: SendDocumentsParams) => {
      const {
        documentIds,
        documentsById,
        importStatuses,
        rowAccounts,
        rowPaymentMethods,
        rowCostCenters,
        rowRetentions,
        rowDates,
        rowObservations,
        retentionsConfiguredIds,
        savePreferences = true,
      } = params

      const targets = documentIds.filter((documentId) => {
        const document = documentsById[documentId]

        return (
          document &&
          canSendDocument(
            document,
            documentId,
            importStatuses[documentId],
            rowAccounts,
            rowPaymentMethods,
            retentionsConfiguredIds,
          )
        )
      })

      if (targets.length === 0) {
        setErrorMessage(
          'Seleccione documentos con cuenta, medio de pago y retenciones configurados.',
        )
        return
      }

      setIsSending(true)
      setErrorMessage(null)
      setFeedbackMessage(null)

      const buildRequest = (
        documentId: string,
      ): SiigoDocumentSendRequest | null => {
        const document = documentsById[documentId]
        const account = rowAccounts[documentId]
        const paymentMethod = rowPaymentMethods[documentId]

        if (!document || !account || !paymentMethod) {
          return null
        }

        return workspace.buildSendRequest(
          document,
          account,
          paymentMethod,
          rowRetentions[documentId] ?? [],
          rowCostCenters[documentId] ?? null,
          rowDates[documentId],
          rowObservations[documentId],
          savePreferences,
        ) as SiigoDocumentSendRequest
      }

      const attemptSend = async (
        documentId: string,
      ): Promise<SendAttemptResult> => {
        const request = buildRequest(documentId)

        if (!request) {
          return {
            documentId,
            success: false,
            error: 'Faltan datos para enviar el documento.',
            isDuplicated: false,
          }
        }

        try {
          await workspace.sendToSiigo(request)

          return {
            documentId,
            success: true,
            isDuplicated: false,
          }
        } catch (error) {
          return {
            documentId,
            success: false,
            error: getApiErrorMessage(
              error,
              'No se pudo enviar el documento a SIIGO.',
            ),
            isDuplicated: isSiigoDuplicatedDocumentError(error),
          }
        }
      }

      const initialResults = await Promise.all(
        targets.map(async (documentId, index) => {
          if (index > 0) {
            await wait(index * SEND_INTERVAL_MS)
          }

          onDocumentStatusChange?.(documentId, IMPORT_ROW_STATUS.EN_PROCESO)

          return attemptSend(documentId)
        }),
      )

      const finalResults = new Map<string, SendAttemptResult>(
        initialResults.map((result) => [result.documentId, result]),
      )

      for (const result of initialResults) {
        if (result.success) {
          onDocumentStatusChange?.(result.documentId, IMPORT_ROW_STATUS.LISTA)
          continue
        }

        if (!result.isDuplicated) {
          onDocumentStatusChange?.(result.documentId, IMPORT_ROW_STATUS.ERROR)
        }
      }

      let duplicatedDocumentIds = initialResults
        .filter((result) => !result.success && result.isDuplicated)
        .map((result) => result.documentId)

      if (duplicatedDocumentIds.length > 0) {
        await wait(DUPLICATE_RETRY_PAUSE_MS)
      }

      for (
        let retryRound = 0;
        retryRound < MAX_DUPLICATE_RETRY_ROUNDS &&
        duplicatedDocumentIds.length > 0;
        retryRound += 1
      ) {
        if (retryRound > 0) {
          await wait(DUPLICATE_RETRY_PAUSE_MS)
        }

        const pendingAfterRound: string[] = []

        for (let index = 0; index < duplicatedDocumentIds.length; index += 1) {
          if (index > 0) {
            await wait(DUPLICATE_RETRY_INTERVAL_MS)
          }

          const documentId = duplicatedDocumentIds[index]
          onDocumentStatusChange?.(documentId, IMPORT_ROW_STATUS.EN_PROCESO)

          const result = await attemptSend(documentId)
          finalResults.set(documentId, result)

          if (result.success) {
            onDocumentStatusChange?.(documentId, IMPORT_ROW_STATUS.LISTA)
            continue
          }

          if (result.isDuplicated) {
            pendingAfterRound.push(documentId)
            continue
          }

          onDocumentStatusChange?.(documentId, IMPORT_ROW_STATUS.ERROR)
        }

        duplicatedDocumentIds = pendingAfterRound
      }

      for (const documentId of duplicatedDocumentIds) {
        onDocumentStatusChange?.(documentId, IMPORT_ROW_STATUS.ERROR)
      }

      const results = targets.map(
        (documentId) =>
          finalResults.get(documentId) ?? {
            documentId,
            success: false,
            error: 'No se pudo enviar el documento a SIIGO.',
            isDuplicated: false,
          },
      )

      const sentCount = results.filter((result) => result.success).length
      const failedCount = results.length - sentCount
      const lastError =
        results.find((result) => !result.success)?.error ?? null

      setIsSending(false)

      if (sentCount > 0) {
        setFeedbackMessage(workspace.sendSuccessFeedback(sentCount, failedCount))
        onCompleted()
      }

      if (failedCount > 0 && sentCount === 0) {
        setErrorMessage(
          lastError ?? 'No se pudieron enviar los documentos seleccionados.',
        )
      }
    },
    [
      onCompleted,
      onDocumentStatusChange,
      setErrorMessage,
      setFeedbackMessage,
      workspace,
    ],
  )

  return {
    isSending,
    feedbackMessage,
    errorMessage,
    sendDocuments,
  }
}
