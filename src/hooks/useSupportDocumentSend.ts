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
import type { PurchaseInvoiceItemDraft } from '../types/purchaseInvoiceItemDraft'
import { IMPORT_ROW_STATUS, type ImportRowStatus } from '../types/import'
import type { DocumentWorkspaceConfig } from '../constants/documentWorkspaceConfig'
import type { SiigoDocumentSendRequest } from '../utils/buildSiigoDocumentRequest'
import { buildNotSendableReason } from '../utils/supportDocumentSend'

/** Espacio entre inicios de envío (requests pueden solaparse). */
const SEND_STAGGER_MS = 2000
/** Registros que quedaron en error esperan al final y se reintentan con más pausa. */
const RETRY_PAUSE_MS = 5000
const MAX_RETRY_ROUNDS = 3

export interface BatchQueueProgress {
  current: number
  total: number
  completed: number
  label: string
}

/** Desglose de un lote de envío recién terminado — Factura de compra SIIGO
 * lo usa para armar el aviso "se enviaron a crear N, X creadas, Y en error"
 * con el mismo mecanismo de "solo esta tanda"/"ver todos" y auto-selección
 * que ya tiene el import (ver SupportDocumentSendNotice y showSendOnly en
 * SupportDocumentPage.tsx). */
export interface SendBatchSummary {
  documentIds: string[]
  successCount: number
  errorCount: number
}

interface SendDocumentsParams {
  documentIds: string[]
  documentsById: Record<string, ElectronicDocumentListItem>
  importStatuses: Record<string, ImportRowStatus>
  rowAccounts: Record<string, SiigoAccountOption | null>
  rowPaymentMethods: Record<string, SiigoPaymentMethodOption | null>
  rowCostCenters: Record<string, SiigoCostCenterOption | null>
  rowRetentions: Record<string, SiigoTaxOption[]>
  rowIva: Record<string, SiigoTaxOption | null>
  rowItems?: Record<string, PurchaseInvoiceItemDraft[]>
  rowDates: Record<string, string>
  rowDueDates: Record<string, string | null>
  rowObservations: Record<string, string>
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
  onCompleted: (summary: SendBatchSummary) => void
  onDocumentStatusChange?: (
    documentId: string,
    status: ImportRowStatus,
  ) => void
}

interface SendAttemptResult {
  documentId: string
  success: boolean
  error?: string
  /** false = se descartó ANTES de llamar a SIIGO (ej. sin cuenta asignada
   * todavía) — reintentarlo no serviría de nada, a diferencia de un error
   * real de la llamada (true). */
  attempted: boolean
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
        rowIva,
        rowItems,
        rowDates,
        rowDueDates,
        rowObservations,
      } = params

      // Se procesan TODOS los seleccionados (no se filtran en silencio antes
      // de intentar) — los que no están listos para enviar (sin cuenta, sin
      // medio de pago, etc.) quedan como un resultado fallido CON razón
      // explícita más abajo, así el conteo final ("N enviados, M fallaron")
      // siempre refleja la selección completa del usuario en vez de hacer
      // desaparecer del conteo a los que se excluyeron antes de intentar
      // (bug real: seleccionar 5 y ver "0 de 3" sin ninguna explicación).
      const targets = documentIds

      const readyTargets = targets.filter((documentId) => {
        const document = documentsById[documentId]

        return (
          document &&
          buildNotSendableReason(
            document,
            documentId,
            importStatuses[documentId],
            rowAccounts,
            rowPaymentMethods,
            rowDueDates,
            rowItems,
            {
              requiresAccount: workspace.requiresAccount,
              requiresPaymentMethod: workspace.requiresPaymentMethod,
            },
          ) === null
        )
      })

      if (readyTargets.length === 0) {
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
          rowIva[documentId] ?? null,
          rowItems?.[documentId] ?? null,
        ) as SiigoDocumentSendRequest
      }

      const attemptSend = async (
        documentId: string,
      ): Promise<SendAttemptResult> => {
        const document = documentsById[documentId]
        const notSendableReason =
          document &&
          buildNotSendableReason(
            document,
            documentId,
            importStatuses[documentId],
            rowAccounts,
            rowPaymentMethods,
            rowDueDates,
            rowItems,
            {
              requiresAccount: workspace.requiresAccount,
              requiresPaymentMethod: workspace.requiresPaymentMethod,
            },
          )

        if (!document || notSendableReason) {
          return {
            documentId,
            success: false,
            attempted: false,
            error: notSendableReason ?? 'Documento no encontrado.',
          }
        }

        // buildRequest (y workspace.buildSendRequest, que arma el body a
        // mano a partir de los datos de la fila) puede tirar una excepción
        // en vez de devolver null si algún dato viene en una forma
        // inesperada — sin este try/catch, esa excepción se escapaba del
        // Promise.all de todo el lote (ver el try/catch general más abajo)
        // y ni el resumen final ni el aviso de "se enviaron N" llegaban a
        // mostrarse: el envío fallaba en silencio, sin ningún mensaje, para
        // TODO el lote (bug real reportado: a veces no aparece ningún aviso
        // al enviar).
        let request: SiigoDocumentSendRequest | null
        try {
          request = buildRequest(documentId)
        } catch (error) {
          return {
            documentId,
            success: false,
            attempted: false,
            error: getApiErrorMessage(
              error,
              'No se pudieron preparar los datos del documento para enviarlo.',
            ),
          }
        }

        if (!request) {
          return {
            documentId,
            success: false,
            attempted: false,
            error: 'Faltan datos para enviar el documento.',
          }
        }

        try {
          await workspace.sendDocument(request)

          return {
            documentId,
            success: true,
            attempted: true,
          }
        } catch (error) {
          return {
            documentId,
            success: false,
            attempted: true,
            error: getApiErrorMessage(
              error,
              'No se pudo enviar el documento.',
            ),
          }
        }
      }

      const runBatch = async (): Promise<void> => {
        const readyTargetSet = new Set(readyTargets)
        const notReadyIds = targets.filter((id) => !readyTargetSet.has(id))

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

        // Los no listos (sin cuenta/medio de pago, proveedor pendiente, etc.)
        // se resuelven de inmediato como fallidos CON razón — no ocupan un
        // turno del stagger de envíos reales ni pasan por "En proceso" (nunca
        // se intentó nada con ellos).
        const notReadyResults: SendAttemptResult[] = []

        for (const documentId of notReadyIds) {
          const result = await attemptSend(documentId)
          notReadyResults.push(result)
          completed += 1
          onDocumentStatusChange?.(documentId, IMPORT_ROW_STATUS.ERROR)
        }

        bumpProgress(`Enviando… ${completed} de ${targets.length} listos`)

        const initialResults = await Promise.all(
          readyTargets.map(async (documentId, index) => {
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

            onDocumentStatusChange?.(
              documentId,
              result.success ? IMPORT_ROW_STATUS.LISTA : IMPORT_ROW_STATUS.ERROR,
            )

            bumpProgress(
              completed === targets.length
                ? `Completado ${completed} de ${targets.length}`
                : `Enviando… ${completed} de ${targets.length} listos`,
            )

            return result
          }),
        )

        const finalResults = new Map<string, SendAttemptResult>(
          [...notReadyResults, ...initialResults].map((result) => [
            result.documentId,
            result,
          ]),
        )

        // Los que quedaron en error esperan al final: se reintentan hasta
        // MAX_RETRY_ROUNDS veces, con RETRY_PAUSE_MS entre cada envío. Solo se
        // reintentan los que SÍ se llegaron a intentar (attempted=true) — los
        // descartados antes de intentar (sin cuenta, etc.) no cambian solos
        // con un reintento.
        let pendingRetryIds = initialResults
          .filter((result) => !result.success && result.attempted)
          .map((result) => result.documentId)

        for (
          let retryRound = 0;
          retryRound < MAX_RETRY_ROUNDS && pendingRetryIds.length > 0;
          retryRound += 1
        ) {
          const nextRoundIds: string[] = []

          for (let index = 0; index < pendingRetryIds.length; index += 1) {
            await wait(RETRY_PAUSE_MS)

            const documentId = pendingRetryIds[index]
            onDocumentStatusChange?.(documentId, IMPORT_ROW_STATUS.EN_PROCESO)
            bumpProgress(
              `Reintento ${retryRound + 1} de ${MAX_RETRY_ROUNDS} — documento ${
                index + 1
              } de ${pendingRetryIds.length}…`,
            )

            const result = await attemptSend(documentId)
            finalResults.set(documentId, result)

            if (result.success) {
              onDocumentStatusChange?.(documentId, IMPORT_ROW_STATUS.LISTA)
              continue
            }

            onDocumentStatusChange?.(documentId, IMPORT_ROW_STATUS.ERROR)
            nextRoundIds.push(documentId)
          }

          pendingRetryIds = nextRoundIds
        }

        const results = targets.map(
          (documentId) =>
            finalResults.get(documentId) ?? {
              documentId,
              success: false,
              attempted: false,
              error: 'No se pudo enviar el documento a SIIGO.',
            },
        )

        const sentCount = results.filter((result) => result.success).length
        const failedCount = results.length - sentCount
        const lastError =
          results.find((result) => !result.success)?.error ?? null

        // Se avisa SIEMPRE que el lote tuvo al menos un documento (incluido
        // el caso "todos fallaron") — a diferencia del feedbackMessage de
        // abajo, que solo se arma cuando hubo al menos un éxito, este resumen
        // es lo que Factura de compra SIIGO usa para armar el aviso con los 3
        // conteos (enviadas/creadas/error) y la auto-selección de la tanda,
        // sin importar el resultado.
        if (results.length > 0) {
          onCompleted({
            documentIds: targets,
            successCount: sentCount,
            errorCount: failedCount,
          })
        }

        if (sentCount > 0) {
          setFeedbackMessage(workspace.sendSuccessFeedback(sentCount, failedCount))
        }

        if (failedCount > 0 && sentCount === 0) {
          setErrorMessage(
            lastError ?? 'No se pudieron enviar los documentos seleccionados.',
          )
        }
      }

      // Red de seguridad: attemptSend ya atrapa los errores esperables (ver
      // comentario ahí sobre buildRequest), pero este try/catch/finally
      // general evita que CUALQUIER excepción no prevista en el resto del
      // lote deje "Enviando..." pegado para siempre y sin ningún aviso —
      // mejor un mensaje de error genérico que un silencio total (bug real
      // reportado: a veces no aparece nada tras enviar).
      try {
        await runBatch()
      } catch (error) {
        setErrorMessage(
          getApiErrorMessage(
            error,
            'Ocurrió un error inesperado al enviar los documentos.',
          ),
        )
      } finally {
        setIsSending(false)
        setQueueProgress(null)
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
