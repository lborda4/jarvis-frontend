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
import { createSiigoSupplier } from '../services/siigoService'
import { formatSiigoSupplierCreatedMessage } from '../utils/formatSiigoSupplierCreatedMessage'
import { inferSiigoSupplierIdentity } from '../utils/inferSiigoSupplierIdentity'
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
  const [isCreatingSupplier, setIsCreatingSupplier] = useState(false)
  const [errorMessage, setErrorMessage] = useAutoDismissMessage(
    AUTO_DISMISS_ERROR_MS,
  )
  const [supplierFeedbackMessage, setSupplierFeedbackMessage] =
    useAutoDismissMessage()

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

  const continueSupplier = useCallback(
    async (document: ElectronicDocumentListItem) => {
      const documentId = document.id.trim()
      const supplierName = document.supplierName?.trim() ?? ''
      const supplierDocument = document.supplierNit?.trim() ?? ''

      if (!documentId) {
        setErrorMessage('No se encontró el documento para crear el proveedor.')
        return
      }

      if (!supplierName || !supplierDocument) {
        setErrorMessage(
          'Faltan el nombre o el documento del proveedor para crearlo en SIIGO.',
        )
        return
      }

      const { personType, idType } = inferSiigoSupplierIdentity(supplierDocument)

      setIsCreatingSupplier(true)
      setErrorMessage(null)
      setSupplierFeedbackMessage(null)
      setImportStatuses((current) => ({
        ...current,
        [documentId]: IMPORT_ROW_STATUS.EN_PROCESO,
      }))

      const payload = {
        documentId,
        name: supplierName,
        identification: supplierDocument,
        person_type: personType,
        id_type: idType,
      }

      console.log('[Support Document] Creando proveedor directamente:', payload)

      try {
        await createSiigoSupplier(payload)

        setSupplierFeedbackMessage(formatSiigoSupplierCreatedMessage())

        await resumeDocument(documentId)
        onFlowCompleted()
      } catch (error) {
        console.error('[Support Document] Error al crear proveedor:', error)

        setImportStatuses((current) => ({
          ...current,
          [documentId]: IMPORT_ROW_STATUS.ERROR,
        }))
        setErrorMessage(
          getApiErrorMessage(
            error,
            'No se pudo crear el proveedor en SIIGO.',
          ),
        )
      } finally {
        setIsCreatingSupplier(false)
      }
    },
    [onFlowCompleted, resumeDocument],
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
    isCreatingSupplier,
    isModalOpen,
    errorMessage,
    supplierFeedbackMessage,
    accountModal,
    resumeDocuments,
    continueSupplier,
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
