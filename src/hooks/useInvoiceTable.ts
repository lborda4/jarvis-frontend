import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useImportSession } from '../context/ImportSessionContext'
import type { ExtractInvoicesResponse, InvoicePreview } from '../types/invoice'
import {
  createInvoiceTableRows,
  type ImportRowStatus,
  type InvoiceTableRow,
} from '../types/import'
import {
  markAccountSavedBeforePurchase,
  markPurchaseCreated,
  markPurchaseFailed,
  processPurchaseImportBatch,
  refreshImportStatusAfterSupplierCreated,
} from '../services/purchaseImportOrchestrator'
import { useAccountMappingModal } from './useAccountMappingModal'
import { useSupplierCreateModal } from './useSupplierCreateModal'

export function useInvoiceTable(data: ExtractInvoicesResponse | null) {
  const {
    getSession,
    updateSiigoFromResponse,
    updateSession,
  } = useImportSession()

  const batchQueueRef = useRef<InvoicePreview[]>([])
  const batchIndexRef = useRef(0)

  const orchestratorDepsRef = useRef<{
    getSession: typeof getSession
    updateSiigoFromResponse: typeof updateSiigoFromResponse
    updateStepStatus: (documentId: string, status: ImportRowStatus) => void
    updateAccountMapping: (
      documentId: string,
      accountCode: string | null,
      autoApply: boolean,
      stepStatus: ImportRowStatus,
    ) => void
  } | null>(null)

  const [rows, setRows] = useState<InvoiceTableRow[]>([])
  const [selectedCufes, setSelectedCufes] = useState<Set<string>>(new Set())
  const [isImporting, setIsImporting] = useState(false)
  const [isRefreshingStatus, setIsRefreshingStatus] = useState(false)

  const updateRowStatus = useCallback((cufe: string, status: ImportRowStatus) => {
    setRows((currentRows) =>
      currentRows.map((row) =>
        row.cufe === cufe ? { ...row, importStatus: status } : row,
      ),
    )
    updateSession(cufe, { stepStatus: status })
  }, [updateSession])

  const updateAccountMapping = useCallback(
    (
      documentId: string,
      accountCode: string | null,
      autoApply: boolean,
      stepStatus: ImportRowStatus,
    ) => {
      setRows((currentRows) =>
        currentRows.map((row) =>
          row.cufe === documentId ? { ...row, importStatus: stepStatus } : row,
        ),
      )
      updateSession(documentId, {
        stepStatus,
        siigo: {
          accountCode,
          autoApply,
        },
        userInput: { accountCode },
      })
    },
    [updateSession],
  )

  const orchestratorDeps = useMemo(
    () => ({
      getSession,
      updateSiigoFromResponse,
      updateStepStatus: updateRowStatus,
      updateAccountMapping,
    }),
    [getSession, updateAccountMapping, updateRowStatus, updateSiigoFromResponse],
  )

  orchestratorDepsRef.current = orchestratorDeps

  const clearBatchQueue = useCallback(() => {
    batchQueueRef.current = []
    batchIndexRef.current = 0
  }, [])

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

  const isModalOpen = supplierModal.isOpen || accountModal.isOpen

  useEffect(() => {
    if (!data) {
      setRows([])
      setSelectedCufes(new Set())
      setIsImporting(false)
      clearBatchQueue()
      return
    }

    setRows(createInvoiceTableRows(data.records ?? []))
    setSelectedCufes(new Set())
    setIsImporting(false)
    clearBatchQueue()
  }, [clearBatchQueue, data])

  const resolveQueuedDocumentId = useCallback((index: number) => {
    return batchQueueRef.current[index]?.cufe?.trim() ?? ''
  }, [])

  const handleBatchResult = useCallback(
    async (
      result: Awaited<ReturnType<typeof processPurchaseImportBatch>>,
    ) => {
      if (result.outcome === 'supplier_not_found') {
        batchIndexRef.current = result.interruptedIndex
        const documentId =
          result.documentId.trim() ||
          resolveQueuedDocumentId(result.interruptedIndex)

        openSupplierNotFoundModal({
          documentId,
          supplierName: result.supplierName,
          supplierDocument: result.supplierDocument,
        })
        return
      }

      if (result.outcome === 'account_mapping_required') {
        batchIndexRef.current = result.interruptedIndex
        const documentId =
          result.documentId.trim() ||
          resolveQueuedDocumentId(result.interruptedIndex)

        openAccountMappingModal({ documentId })
        return
      }

      clearBatchQueue()
    },
    [
      clearBatchQueue,
      openAccountMappingModal,
      openSupplierNotFoundModal,
      resolveQueuedDocumentId,
    ],
  )

  const resumeBatchFromNext = useCallback(async () => {
    const queue = batchQueueRef.current
    const nextIndex = batchIndexRef.current + 1

    if (nextIndex >= queue.length) {
      clearBatchQueue()
      return
    }

    setIsImporting(true)

    try {
      const result = await processPurchaseImportBatch(
        queue,
        orchestratorDeps,
        nextIndex,
      )
      await handleBatchResult(result)
    } finally {
      setIsImporting(false)
    }
  }, [clearBatchQueue, handleBatchResult, orchestratorDeps])

  const runBatch = useCallback(
    async (records: InvoicePreview[], startIndex: number) => {
      batchQueueRef.current = records
      batchIndexRef.current = startIndex

      const result = await processPurchaseImportBatch(
        records,
        orchestratorDeps,
        startIndex,
      )

      await handleBatchResult(result)
    },
    [handleBatchResult, orchestratorDeps],
  )

  const toggleRowSelection = useCallback((cufe: string) => {
    setSelectedCufes((current) => {
      const next = new Set(current)

      if (next.has(cufe)) {
        next.delete(cufe)
      } else {
        next.add(cufe)
      }

      return next
    })
  }, [])

  const selectRows = useCallback((cufes: string[]) => {
    setSelectedCufes(new Set(cufes))
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedCufes(new Set())
  }, [])

  const selectedRows = useMemo(
    () => rows.filter((row) => selectedCufes.has(row.cufe)),
    [rows, selectedCufes],
  )

  const importSelected = useCallback(async () => {
    if (selectedRows.length === 0 || isImporting || isModalOpen) return

    setIsImporting(true)

    try {
      await runBatch(selectedRows, 0)
    } finally {
      setIsImporting(false)
    }
  }, [isImporting, isModalOpen, runBatch, selectedRows])

  const handleCreateSupplier = useCallback(() => {
    const documentId =
      supplierModal.documentId.trim() ||
      resolveQueuedDocumentId(batchIndexRef.current)

    void createSupplier(documentId)
  }, [createSupplier, resolveQueuedDocumentId, supplierModal.documentId])

  const handleContinueAfterSupplierCreated = useCallback(async () => {
    const documentId =
      supplierModal.documentId.trim() ||
      resolveQueuedDocumentId(batchIndexRef.current)

    if (!documentId) {
      closeSupplierModal()
      return
    }

    closeSupplierModal()
    setIsRefreshingStatus(true)

    try {
      const result = await refreshImportStatusAfterSupplierCreated(
        documentId,
        orchestratorDeps,
      )

      if (result.outcome === 'account_mapping_required') {
        openAccountMappingModal({ documentId })
        return
      }

      if (batchQueueRef.current.length > 0) {
        await resumeBatchFromNext()
      }
    } finally {
      setIsRefreshingStatus(false)
    }
  }, [
    closeSupplierModal,
    openAccountMappingModal,
    orchestratorDeps,
    resumeBatchFromNext,
    resolveQueuedDocumentId,
    supplierModal.documentId,
  ])

  const handleCloseSupplierModal = useCallback(() => {
    closeSupplierModal()
    clearBatchQueue()
  }, [clearBatchQueue, closeSupplierModal])

  const handleCloseAccountModal = useCallback(() => {
    closeAccountModal()
    clearBatchQueue()
  }, [closeAccountModal, clearBatchQueue])

  const handleSaveAccount = useCallback(() => {
    const documentId =
      accountModal.documentId.trim() ||
      resolveQueuedDocumentId(batchIndexRef.current)

    void saveAccount(documentId)
  }, [accountModal.documentId, resolveQueuedDocumentId, saveAccount])

  const handleAcceptPurchase = useCallback(async () => {
    closeAccountModal()

    if (batchQueueRef.current.length > 0) {
      await resumeBatchFromNext()
    }
  }, [closeAccountModal, resumeBatchFromNext])

  return {
    rows,
    selectedCufes,
    selectedRows,
    isImporting: isImporting || isRefreshingStatus,
    supplierModal,
    accountModal,
    toggleRowSelection,
    selectRows,
    clearSelection,
    importSelected,
    closeSupplierModal: handleCloseSupplierModal,
    createSupplier: handleCreateSupplier,
    retryCreateSupplier,
    continueAfterSupplierCreated: handleContinueAfterSupplierCreated,
    closeAccountModal: handleCloseAccountModal,
    selectAccount,
    setAutoApply,
    saveAccount: handleSaveAccount,
    retrySaveAccount,
    acceptPurchase: handleAcceptPurchase,
  }
}
