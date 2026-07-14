import { useCallback, useEffect, useState } from 'react'
import {
  AUTO_DISMISS_ERROR_MS,
  useAutoDismissMessage,
} from './useAutoDismissMessage'
import { resumeElectronicDocument } from '../services/electronicDocumentService'
import { getApiErrorMessage } from '../services/apiClient'
import type { ElectronicDocumentListItem } from '../types/electronicDocument'
import {
  IMPORT_ROW_STATUS,
  type ImportRowStatus,
} from '../types/import'
import {
  mapDocumentToImportRowStatus,
  mapResumeNextStepToImportStatus,
} from '../utils/mapImportRowStatus'
import { useAccountMappingModal } from './useAccountMappingModal'

interface UseSupportDocumentResumeOptions {
  documents: ElectronicDocumentListItem[]
  setDocuments: React.Dispatch<
    React.SetStateAction<ElectronicDocumentListItem[]>
  >
  onFlowCompleted: () => void
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
        if (current[document.id] === IMPORT_ROW_STATUS.EN_PROCESO) {
          continue
        }

        next[document.id] = mapDocumentToImportRowStatus(document)
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

  const resumeDocuments = useCallback(
    async (documentIds: string[]) => {
      const uniqueIds = [...new Set(documentIds.map((id) => id.trim()).filter(Boolean))]

      if (uniqueIds.length === 0) {
        return
      }

      setIsResuming(true)
      setErrorMessage(null)

      try {
        for (const documentId of uniqueIds) {
          await resumeDocument(documentId)
        }
      } catch (error) {
        setErrorMessage(
          getApiErrorMessage(
            error,
            'No se pudo validar el estado de los documentos importados.',
          ),
        )
      } finally {
        setIsResuming(false)
      }
    },
    [resumeDocument],
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
    resumeDocuments,
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
