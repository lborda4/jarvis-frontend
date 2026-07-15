import { useCallback, useEffect, useState } from 'react'
import {
  AUTO_DISMISS_ERROR_MS,
  useAutoDismissMessage,
} from './useAutoDismissMessage'
import {
  fetchElectronicDocuments,
  resumeElectronicDocument,
} from '../services/electronicDocumentService'
import { getApiErrorMessage } from '../services/apiClient'
import {
  ELECTRONIC_DOCUMENT_TYPE,
  type ElectronicDocumentListItem,
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

interface UseSupportDocumentResumeOptions {
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

  return missing.length > 0 ? [...missing, ...merged] : merged
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

export function useSupportDocumentResume({
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
        const response = await resumeElectronicDocument(normalizedId)
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
    [updateDocumentFromResume],
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
        for (let attempt = 0; attempt < VALIDATION_MAX_ATTEMPTS; attempt += 1) {
          const response = await fetchElectronicDocuments({
            electronicDocumentType: ELECTRONIC_DOCUMENT_TYPE.SUPPORT_DOCUMENT,
            page: 1,
            limit: Math.max(uniqueIds.length + 10, 50),
          })

          const imported = response.items.filter((document) =>
            uniqueIds.includes(document.id),
          )

          setDocuments((current) => mergeImportedDocuments(current, imported))

          if (
            imported.length === uniqueIds.length &&
            imported.every((document) => !isSupplierCheckPending(document))
          ) {
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
        setIsResuming(false)
        onRefresh?.()
      }
    },
    [setDocuments],
  )

  const {
    modalState: accountModal,
    openAccountMappingModal,
    closeModal: closeAccountModal,
    selectAccount,
    setAutoApply,
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
    setAutoApply,
    saveAccount: handleSaveAccount,
    retrySaveAccount,
    acceptPurchase: handleAcceptPurchase,
    setImportStatus,
  }
}
