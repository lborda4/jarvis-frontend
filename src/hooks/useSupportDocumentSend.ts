import { useCallback, useState } from 'react'
import {
  AUTO_DISMISS_ERROR_MS,
  useAutoDismissMessage,
} from './useAutoDismissMessage'
import type { SiigoAccountOption } from '../constants/siigoAccountCatalog'
import type { SiigoPaymentMethodOption } from '../constants/siigoPaymentMethodCatalog'
import type { SiigoTaxOption } from '../constants/siigoTaxCatalog'
import { getApiErrorMessage } from '../services/apiClient'
import {
  createSiigoSupportDocument,
} from '../services/siigoService'
import type { ElectronicDocumentListItem } from '../types/electronicDocument'
import { IMPORT_ROW_STATUS, type ImportRowStatus } from '../types/import'
import { buildSiigoSupportDocumentRequest } from '../utils/buildSiigoSupportDocumentRequest'
import { canSendDocument } from '../utils/supportDocumentSend'

const SEND_STAGGER_MS = 300

interface SendDocumentsParams {
  documentIds: string[]
  documentsById: Record<string, ElectronicDocumentListItem>
  importStatuses: Record<string, ImportRowStatus>
  rowAccounts: Record<string, SiigoAccountOption | null>
  rowPaymentMethods: Record<string, SiigoPaymentMethodOption | null>
  rowRetentions: Record<string, SiigoTaxOption[]>
  rowDates: Record<string, string>
  retentionsConfiguredIds: Set<string>
  savePreferences?: boolean
}

interface UseSupportDocumentSendOptions {
  onCompleted: () => void
  onDocumentStatusChange?: (
    documentId: string,
    status: ImportRowStatus,
  ) => void
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

export function useSupportDocumentSend({
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
        rowRetentions,
        rowDates,
        retentionsConfiguredIds,
        savePreferences,
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

      const sendSingleDocument = async (
        documentId: string,
        staggerIndex: number,
      ): Promise<{ documentId: string; success: boolean; error?: string }> => {
        if (staggerIndex > 0) {
          await wait(staggerIndex * SEND_STAGGER_MS)
        }

        const document = documentsById[documentId]
        const account = rowAccounts[documentId]
        const paymentMethod = rowPaymentMethods[documentId]
        const retentions = rowRetentions[documentId] ?? []
        const selectedDate = rowDates[documentId]

        if (!document || !account || !paymentMethod) {
          return {
            documentId,
            success: false,
            error: 'Faltan datos para enviar el documento.',
          }
        }

        onDocumentStatusChange?.(documentId, IMPORT_ROW_STATUS.EN_PROCESO)

        try {
          const request = buildSiigoSupportDocumentRequest(
            document,
            account,
            paymentMethod,
            retentions,
            selectedDate,
            savePreferences,
          )

          await createSiigoSupportDocument(request)
          onDocumentStatusChange?.(documentId, IMPORT_ROW_STATUS.LISTA)

          return { documentId, success: true }
        } catch (error) {
          onDocumentStatusChange?.(documentId, IMPORT_ROW_STATUS.ERROR)

          const errorMessage = getApiErrorMessage(
            error,
            'No se pudo enviar el documento a SIIGO.',
          )

          if (errorMessage.toLowerCase().includes('no existe en siigo')) {
            onDocumentStatusChange?.(
              documentId,
              IMPORT_ROW_STATUS.REQUIERE_PROVEEDOR,
            )
            onCompleted()
          }

          return {
            documentId,
            success: false,
            error: errorMessage,
          }
        }
      }

      const results = await Promise.all(
        targets.map((documentId, index) =>
          sendSingleDocument(documentId, index),
        ),
      )

      const sentCount = results.filter((result) => result.success).length
      const failedCount = results.length - sentCount
      const lastError =
        results.find((result) => !result.success)?.error ?? null

      setIsSending(false)

      if (sentCount > 0) {
        setFeedbackMessage(
          failedCount > 0
            ? `${sentCount} documento(s) enviados. ${failedCount} fallaron.`
            : `${sentCount} documento(s) enviados correctamente a SIIGO.`,
        )
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
    ],
  )

  return {
    isSending,
    feedbackMessage,
    errorMessage,
    sendDocuments,
  }
}
