import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  fetchElectronicDocuments,
  resumeElectronicDocument,
} from '../services/electronicDocumentService'
import {
  markAccountSavedBeforePurchase,
  markPurchaseCreated,
  markPurchaseFailed,
  refreshImportStatusAfterSupplierCreated,
  type ImportOrchestratorDeps,
} from '../services/purchaseImportOrchestrator'
import type {
  ElectronicDocumentListFilters,
  ElectronicDocumentListItem,
  ElectronicDocumentType,
} from '../types/electronicDocument'
import { getApiErrorMessage } from '../services/apiClient'
import { useAccountMappingModal } from './useAccountMappingModal'
import { useSupplierCreateModal } from './useSupplierCreateModal'

const EMPTY_FILTERS: ElectronicDocumentListFilters = {
  status: '',
  dateFrom: '',
  dateTo: '',
  search: '',
}

export function useDocumentDashboard(
  electronicDocumentType: ElectronicDocumentType,
) {
  const [documents, setDocuments] = useState<ElectronicDocumentListItem[]>([])
  const [filters, setFilters] =
    useState<ElectronicDocumentListFilters>(EMPTY_FILTERS)
  const [isLoading, setIsLoading] = useState(true)
  const [isResuming, setIsResuming] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [total, setTotal] = useState(0)

  const orchestratorDepsRef = useRef<ImportOrchestratorDeps | null>(null)

  const noopOrchestratorDeps = useMemo<ImportOrchestratorDeps>(
    () => ({
      getSession: () => undefined,
      updateSiigoFromResponse: () => undefined,
      updateStepStatus: () => undefined,
      updateAccountMapping: () => undefined,
    }),
    [],
  )

  orchestratorDepsRef.current = noopOrchestratorDeps

  const reloadDocuments = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage(null)

    try {
      const response = await fetchElectronicDocuments({
        ...filters,
        electronicDocumentType,
      })
      setDocuments(response.items)
      setTotal(response.total)
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(error, 'No se pudieron cargar los documentos.'),
      )
    } finally {
      setIsLoading(false)
    }
  }, [electronicDocumentType, filters])

  useEffect(() => {
    void reloadDocuments()
  }, [reloadDocuments])

  const handleFlowCompleted = useCallback(() => {
    void reloadDocuments()
  }, [reloadDocuments])

  const {
    modalState: supplierModal,
    openSupplierNotFoundModal,
    closeModal: closeSupplierModal,
    createSupplier,
    retryCreateSupplier,
  } = useSupplierCreateModal()

  const {
    modalState: accountModal,
    openAccountMappingModal,
    closeModal: closeAccountModal,
    selectAccount,
    setAutoApply,
    saveAccount,
    retrySaveAccount,
  } = useAccountMappingModal({
    onAccountSaved: ({ documentId, accountCode, autoApply }) => {
      if (!orchestratorDepsRef.current) return

      markAccountSavedBeforePurchase(
        documentId,
        accountCode,
        autoApply,
        orchestratorDepsRef.current,
      )
    },
    onPurchaseCreated: ({ documentId }) => {
      if (!orchestratorDepsRef.current) return

      markPurchaseCreated(documentId, orchestratorDepsRef.current)
    },
    onPurchaseFailed: ({ documentId }) => {
      if (!orchestratorDepsRef.current) return

      markPurchaseFailed(documentId, orchestratorDepsRef.current)
    },
  })

  const openSupplierModalForDocument = useCallback(
    (document: ElectronicDocumentListItem) => {
      openSupplierNotFoundModal({
        documentId: document.id,
        supplierName: document.supplierName,
        supplierDocument: document.supplierNit ?? '',
      })
    },
    [openSupplierNotFoundModal],
  )

  const openAccountModalForDocument = useCallback(
    (document: ElectronicDocumentListItem) => {
      openAccountMappingModal({ documentId: document.id })
    },
    [openAccountMappingModal],
  )

  const continueSupplier = useCallback(
    (document: ElectronicDocumentListItem) => {
      openSupplierModalForDocument(document)
    },
    [openSupplierModalForDocument],
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
        const response = await resumeElectronicDocument(document.id)
        setDocuments((current) =>
          current.map((item) =>
            item.id === response.document.id ? response.document : item,
          ),
        )

        if (response.nextStep === 'SUPPLIER_REQUIRED') {
          openSupplierModalForDocument(response.document)
          return
        }

        if (response.nextStep === 'ACCOUNT_REQUIRED') {
          openAccountModalForDocument(response.document)
          return
        }

        if (response.nextStep === 'FAILED') {
          setErrorMessage(
            response.message ??
              'No se pudo reanudar el proceso del documento.',
          )
        }
      } catch (error) {
        setErrorMessage(
          getApiErrorMessage(error, 'No se pudo reanudar el documento.'),
        )
      } finally {
        setIsResuming(false)
      }
    },
    [openAccountModalForDocument, openSupplierModalForDocument],
  )

  const handleCreateSupplier = useCallback(() => {
    void createSupplier(supplierModal.documentId)
  }, [createSupplier, supplierModal.documentId])

  const handleContinueAfterSupplierCreated = useCallback(async () => {
    const documentId = supplierModal.documentId.trim()

    if (!documentId) {
      closeSupplierModal()
      return
    }

    closeSupplierModal()

    try {
      const result = await refreshImportStatusAfterSupplierCreated(
        documentId,
        noopOrchestratorDeps,
      )

      if (result.outcome === 'account_mapping_required') {
        openAccountMappingModal({ documentId })
        return
      }

      handleFlowCompleted()
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(error, 'No se pudo continuar con el documento.'),
      )
    }
  }, [
    closeSupplierModal,
    handleFlowCompleted,
    noopOrchestratorDeps,
    openAccountMappingModal,
    supplierModal.documentId,
  ])

  const handleSaveAccount = useCallback(() => {
    void saveAccount(accountModal.documentId)
  }, [accountModal.documentId, saveAccount])

  const handleAcceptPurchase = useCallback(() => {
    closeAccountModal()
    handleFlowCompleted()
  }, [closeAccountModal, handleFlowCompleted])

  const updateFilter = useCallback(
    <K extends keyof ElectronicDocumentListFilters>(
      key: K,
      value: ElectronicDocumentListFilters[K],
    ) => {
      setFilters((current) => ({
        ...current,
        [key]: value,
      }))
    },
    [],
  )

  const resetFilters = useCallback(() => {
    setFilters(EMPTY_FILTERS)
  }, [])

  const isModalOpen = supplierModal.isOpen || accountModal.isOpen

  return {
    documents,
    filters,
    total,
    isLoading,
    isResuming,
    isModalOpen,
    errorMessage,
    supplierModal,
    accountModal,
    updateFilter,
    resetFilters,
    reloadDocuments,
    continueSupplier,
    continueAccount,
    retryDocument,
    closeSupplierModal,
    closeAccountModal,
    handleCreateSupplier,
    retryCreateSupplier,
    continueAfterSupplierCreated: handleContinueAfterSupplierCreated,
    selectAccount,
    setAutoApply,
    saveAccount: handleSaveAccount,
    retrySaveAccount,
    acceptPurchase: handleAcceptPurchase,
  }
}
