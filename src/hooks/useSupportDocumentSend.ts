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

/** Espacio entre inicios de envío (requests pueden solaparse). */
const SEND_STAGGER_MS = 1000
const DUPLICATE_RETRY_PAUSE_MS = 5000
const MAX_DUPLICATE_RETRY_ROUNDS = 2

export interface BatchQueueProgress {
  current: number
  total: number
  completed: number
  label: string
}

interface SendDocumentsParams {
  documentIds: string[]
  documentsById: Record<string, ElectronicDocumentListItem>
  importStatuses: Record<string, ImportRowStatus>
  rowAccounts: Record<string, SiigoAccountOption | null>
  rowPaymentMethods: Record<string, SiigoPaymentMethodOption | null>
  rowCostCenters: Record<string, SiigoCostCenterOption | null>
  rowRetentions: Record<string, SiigoTaxOption[]>
  rowDates: Record<string, string>
  rowDueDates: Record<string, string | null>
  rowObservations: Record<string, string>
  savePreferences?: boolean
}

interface UseSupportDocumentSendOptions {
  workspace: Pick<
    DocumentWorkspaceConfig,
    | 'buildSendRequest'
    | 'sendDocument'
    | 'sendSuccessFeedback'
    | 'requiresAccount'
    | 'requiresPaymentMethod'
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
  const [queueProgress, setQueueProgress] = useState<BatchQueueProgress | null>(
    null,
  )
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
        rowDueDates,
        rowObservations,
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
            {
              requiresAccount: workspace.requiresAccount,
              requiresPaymentMethod: workspace.requiresPaymentMethod,
            },
          )
        )
      })

      if (targets.length === 0) {
        setErrorMessage(
          workspace.requiresAccount
            ? 'Seleccione documentos con cuenta contable y medio de pago configurados.'
            : 'Seleccione documentos listos para enviar.',
        )
        return
      }

      setIsSending(true)
      setErrorMessage(null)
      setFeedbackMessage(null)
      setQueueProgress({
        current: 0,
        total: targets.length,
        completed: 0,
        label: 'Preparando envío a SIIGO...',
      })

      const buildRequest = (
        documentId: string,
      ): SiigoDocumentSendRequest | null => {
        const document = documentsById[documentId]
        const account = rowAccounts[documentId] ?? null
        const paymentMethod = rowPaymentMethods[documentId] ?? null

        if (!document) {
          return null
        }

        if (workspace.requiresAccount && !account) {
          return null
        }

        if (workspace.requiresPaymentMethod && !paymentMethod) {
          return null
        }

        return workspace.buildSendRequest(
          document,
          account,
          paymentMethod,
          rowRetentions[documentId] ?? [],
          rowCostCenters[documentId] ?? null,
          rowDates[documentId],
          rowDueDates[documentId] ?? undefined,
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
          await workspace.sendDocument(request)

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
              'No se pudo enviar el documento.',
            ),
            isDuplicated: isSiigoDuplicatedDocumentError(error),
          }
        }
      }

      let completed = 0
      let started = 0

      const bumpProgress = (label: string) => {
        setQueueProgress({
          current: Math.min(Math.max(started, completed), targets.length),
          total: targets.length,
          completed,
          label,
        })
      }

      const initialResults = await Promise.all(
        targets.map(async (documentId, index) => {
          if (index > 0) {
            await wait(index * SEND_STAGGER_MS)
          }

          started += 1
          onDocumentStatusChange?.(documentId, IMPORT_ROW_STATUS.EN_PROCESO)
          bumpProgress(
            `Enviando… ${completed} de ${targets.length} listos`,
          )

          const result = await attemptSend(documentId)
          completed += 1

          if (result.success) {
            onDocumentStatusChange?.(documentId, IMPORT_ROW_STATUS.LISTA)
          } else if (!result.isDuplicated) {
            onDocumentStatusChange?.(documentId, IMPORT_ROW_STATUS.ERROR)
          }

          bumpProgress(
            completed === targets.length
              ? `Completado ${completed} de ${targets.length}`
              : `Enviando… ${completed} de ${targets.length} listos`,
          )

          return result
        }),
      )

      const finalResults = new Map<string, SendAttemptResult>(
        initialResults.map((result) => [result.documentId, result]),
      )

      let duplicatedDocumentIds = initialResults
        .filter((result) => !result.success && result.isDuplicated)
        .map((result) => result.documentId)

      for (
        let retryRound = 0;
        retryRound < MAX_DUPLICATE_RETRY_ROUNDS &&
        duplicatedDocumentIds.length > 0;
        retryRound += 1
      ) {
        bumpProgress(
          `Reintentando ${duplicatedDocumentIds.length} documento(s)…`,
        )
        await wait(DUPLICATE_RETRY_PAUSE_MS)

        const pendingAfterRound: string[] = []

        for (let index = 0; index < duplicatedDocumentIds.length; index += 1) {
          if (index > 0) {
            await wait(DUPLICATE_RETRY_PAUSE_MS)
          }

          const documentId = duplicatedDocumentIds[index]
          onDocumentStatusChange?.(documentId, IMPORT_ROW_STATUS.EN_PROCESO)
          bumpProgress(
            `Reintento ${index + 1} de ${duplicatedDocumentIds.length}…`,
          )

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
      setQueueProgress(null)

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
    queueProgress,
    feedbackMessage,
    errorMessage,
    sendDocuments,
  }
}
