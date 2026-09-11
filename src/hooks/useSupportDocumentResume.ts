import { useCallback, useEffect, useState } from 'react'
import {
  AUTO_DISMISS_ERROR_MS,
  useAutoDismissMessage,
} from './useAutoDismissMessage'
import { pickSmallestPageSizeCovering } from '../constants/electronicDocuments'
import {
  fetchElectronicDocuments,
  resumeElectronicDocument,
  resumeElectronicDocumentsBatch,
} from '../services/electronicDocumentService'
import { getApiErrorMessage } from '../services/apiClient'
import {
  type ElectronicDocumentListItem,
  type ElectronicDocumentType,
} from '../types/electronicDocument'
import {
  IMPORT_ROW_STATUS,
  type ImportRowStatus,
} from '../types/import'
import {
  mapDocumentToImportRowStatus,
  mapResumeNextStepToImportStatus,
} from '../utils/mapImportRowStatus'
import { isSupplierCheckPending } from '../utils/supplierSiigoStatus'
import { useAccountMappingModal } from './useAccountMappingModal'

const VALIDATION_POLL_INTERVAL_MS = 1000
const VALIDATION_MAX_ATTEMPTS = 45
/** Documentos validados por segundo que se puede esperar del backend, dado
 * su límite de 5 en simultáneo contra la API real de SIIGO (ver
 * SIIGO_DOCUMENT_PREPARATION_CONCURRENCY) — con esto, un lote grande recibe
 * una ventana de espera proporcional en vez de agotar siempre el mismo tope
 * fijo pensado para lotes chicos. Caso real reportado: un import de 74
 * documentos disparaba el aviso de "tardando más de lo esperado" con la
 * ventana fija de 45s, aunque el backend siguiera validando de fondo. */
const ESTIMATED_DOCUMENTS_VALIDATED_PER_SECOND = 2

function computeValidationMaxAttempts(documentCount: number): number {
  const estimatedSeconds = Math.ceil(
    documentCount / ESTIMATED_DOCUMENTS_VALIDATED_PER_SECOND,
  )

  return Math.max(VALIDATION_MAX_ATTEMPTS, estimatedSeconds)
}

interface UseSupportDocumentResumeOptions {
  electronicDocumentType: ElectronicDocumentType
  provider?: 'SIIGO' | 'JARVIS'
  documents: ElectronicDocumentListItem[]
  setDocuments: React.Dispatch<
    React.SetStateAction<ElectronicDocumentListItem[]>
  >
  onFlowCompleted: () => void
}

function mergeImportedDocuments(
  current: ElectronicDocumentListItem[],
  imported: ElectronicDocumentListItem[],
): ElectronicDocumentListItem[] {
  if (imported.length === 0) {
    return current
  }

  const updates = new Map(imported.map((document) => [document.id, document]))
  const merged = current.map((document) => updates.get(document.id) ?? document)
  const missing = imported.filter(
    (document) => !current.some((item) => item.id === document.id),
  )
  const combined =
    missing.length > 0 ? [...missing, ...merged] : merged

  return [...combined].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  )
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

export function useSupportDocumentResume({
  electronicDocumentType,
  provider = 'SIIGO',
  documents,
  setDocuments,
  onFlowCompleted,
}: UseSupportDocumentResumeOptions) {
  const [importStatuses, setImportStatuses] = useState<
    Record<string, ImportRowStatus>
  >({})
  const [isResuming, setIsResuming] = useState(false)
  const [errorMessage, setErrorMessage] = useAutoDismissMessage(
    AUTO_DISMISS_ERROR_MS,
  )

  useEffect(() => {
    setImportStatuses((current) => {
      const next = { ...current }

      for (const document of documents) {
        const mappedStatus = mapDocumentToImportRowStatus(document)
        const currentStatus = current[document.id]

        if (currentStatus === IMPORT_ROW_STATUS.EN_PROCESO) {
          if (mappedStatus !== IMPORT_ROW_STATUS.EN_PROCESO) {
            next[document.id] = mappedStatus
          }
          continue
        }

        next[document.id] = mappedStatus
      }

      return next
    })
  }, [documents])

  const updateDocumentFromResume = useCallback(
    (document: ElectronicDocumentListItem, importStatus: ImportRowStatus) => {
      setDocuments((current) =>
        current.map((item) => (item.id === document.id ? document : item)),
      )
      setImportStatuses((current) => ({
        ...current,
        [document.id]: importStatus,
      }))
    },
    [setDocuments],
  )

  const resumeDocument = useCallback(
    async (documentId: string): Promise<ImportRowStatus> => {
      const normalizedId = documentId.trim()

      if (!normalizedId) {
        return IMPORT_ROW_STATUS.ERROR
      }

      setImportStatuses((current) => ({
        ...current,
        [normalizedId]: IMPORT_ROW_STATUS.EN_PROCESO,
      }))

      try {
        const response = await resumeElectronicDocument(normalizedId, provider)
        const importStatus = mapResumeNextStepToImportStatus(response.nextStep)

        updateDocumentFromResume(response.document, importStatus)

        return importStatus
      } catch (error) {
        setImportStatuses((current) => ({
          ...current,
          [normalizedId]: IMPORT_ROW_STATUS.ERROR,
        }))
        throw error
      }
    },
    [provider, updateDocumentFromResume],
  )

  const watchImportedDocuments = useCallback(
    async (documentIds: string[], onRefresh?: () => void) => {
      const uniqueIds = [
        ...new Set(documentIds.map((id) => id.trim()).filter(Boolean)),
      ]

      if (uniqueIds.length === 0) {
        return
      }

      setIsResuming(true)
      setErrorMessage(null)

      setImportStatuses((current) => {
        const next = { ...current }

        for (const documentId of uniqueIds) {
          next[documentId] = IMPORT_ROW_STATUS.EN_PROCESO
        }

        return next
      })

      try {
        // Un solo request en lote para SIIGO (el backend ya reparte la
        // concurrencia real contra su API) en vez de un resume() por
        // documento en paralelo desde acá — antes, importar 50 facturas
        // disparaba 50 llamadas simultáneas sin ningún límite, saturando
        // el rate limit de SIIGO y disparando el aviso de "la validación
        // está tardando más de lo esperado". Jarvis no tiene endpoint en
        // lote todavía, así que sigue resumiendo uno por uno.
        if (provider === 'SIIGO') {
          await resumeElectronicDocumentsBatch(uniqueIds)
        } else {
          await Promise.all(
            uniqueIds.map(async (documentId) => {
              try {
                await resumeElectronicDocument(documentId, provider)
              } catch {
                // El polling continuará leyendo el estado actualizado del documento.
              }
            }),
          )
        }
      } catch {
        // El polling continuará leyendo el estado actualizado del documento.
      }

      let lastImported: ElectronicDocumentListItem[] = []
      const maxAttempts = computeValidationMaxAttempts(uniqueIds.length)

      try {
        for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
          const response = await fetchElectronicDocuments(
            {
              electronicDocumentType,
              page: 1,
              limit: pickSmallestPageSizeCovering(uniqueIds.length + 10),
            },
            // Fuerza bypass de la caché de 10 minutos (ver
            // fetchElectronicDocuments): sin esto, cada intento del loop
            // devolvía la misma respuesta cacheada del primero en vez de
            // reflejar lo que el backend ya validó de fondo.
            { force: true },
          )

          const imported = response.items.filter((document) =>
            uniqueIds.includes(document.id),
          )
          lastImported = imported

          setDocuments((current) => mergeImportedDocuments(current, imported))

          if (
            imported.length === uniqueIds.length &&
            imported.every((document) => !isSupplierCheckPending(document))
          ) {
            setImportStatuses((current) => {
              const next = { ...current }

              for (const document of imported) {
                next[document.id] = mapDocumentToImportRowStatus(document)
              }

              return next
            })
            onRefresh?.()
            return
          }

          await sleep(VALIDATION_POLL_INTERVAL_MS)
        }

        setErrorMessage(
          'La validación de proveedores está tardando más de lo esperado. Actualice la página en unos segundos.',
        )
      } catch (error) {
        setErrorMessage(
          getApiErrorMessage(
            error,
            'No se pudo validar el estado de los documentos importados.',
          ),
        )
      } finally {
        if (lastImported.length > 0) {
          setImportStatuses((current) => {
            const next = { ...current }

            for (const document of lastImported) {
              next[document.id] = mapDocumentToImportRowStatus(document)
            }

            return next
          })
        }

        setIsResuming(false)
        onRefresh?.()
      }
    },
    [electronicDocumentType, provider, setDocuments, setErrorMessage],
  )

  const {
    modalState: accountModal,
    openAccountMappingModal,
    closeModal: closeAccountModal,
    selectAccount,
    saveAccount,
    retrySaveAccount,
  } = useAccountMappingModal({
    onPurchaseCreated: ({ documentId }) => {
      setImportStatuses((current) => ({
        ...current,
        [documentId]: IMPORT_ROW_STATUS.LISTA,
      }))
    },
    onPurchaseFailed: ({ documentId }) => {
      setImportStatuses((current) => ({
        ...current,
        [documentId]: IMPORT_ROW_STATUS.ERROR,
      }))
    },
  })

  const openAccountModalForDocument = useCallback(
    (document: ElectronicDocumentListItem) => {
      openAccountMappingModal({ documentId: document.id })
    },
    [openAccountMappingModal],
  )

  const continueAccount = useCallback(
    (document: ElectronicDocumentListItem) => {
      openAccountModalForDocument(document)
    },
    [openAccountModalForDocument],
  )

  const retryDocument = useCallback(
    async (document: ElectronicDocumentListItem) => {
      setIsResuming(true)
      setErrorMessage(null)

      try {
        await resumeDocument(document.id)
      } catch (error) {
        setErrorMessage(
          getApiErrorMessage(error, 'No se pudo reanudar el documento.'),
        )
      } finally {
        setIsResuming(false)
      }
    },
    [resumeDocument],
  )

  const handleSaveAccount = useCallback(() => {
    void saveAccount(accountModal.documentId)
  }, [accountModal.documentId, saveAccount])

  const handleAcceptPurchase = useCallback(() => {
    closeAccountModal()
    onFlowCompleted()
  }, [closeAccountModal, onFlowCompleted])

  const setImportStatus = useCallback(
    (documentId: string, importStatus: ImportRowStatus) => {
      setImportStatuses((current) => ({
        ...current,
        [documentId]: importStatus,
      }))
    },
    [],
  )

  const isModalOpen = accountModal.isOpen

  return {
    importStatuses,
    isResuming,
    isModalOpen,
    errorMessage,
    accountModal,
    watchImportedDocuments,
    continueAccount,
    retryDocument,
    closeAccountModal,
    selectAccount,
    saveAccount: handleSaveAccount,
    retrySaveAccount,
    acceptPurchase: handleAcceptPurchase,
    setImportStatus,
  }
}
