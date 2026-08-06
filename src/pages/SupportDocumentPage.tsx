import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { useNavigate } from 'react-router-dom'
import type { SiigoAccountOption } from '../constants/siigoAccountCatalog'
import type { SiigoCostCenterOption } from '../constants/siigoCostCenterCatalog'
import { NONE_COST_CENTER_OPTION } from '../constants/siigoCostCenterCatalog'
import type { SiigoPaymentMethodOption } from '../constants/siigoPaymentMethodCatalog'
import type { SiigoTaxOption } from '../constants/siigoTaxCatalog'
import {
  normalizeRetentionsForTypes,
  retentionTaxTypesMatch,
  splitRetentionsByTypes,
} from '../constants/siigoTaxCatalog'
import {
  SUPPORT_DOCUMENT_WORKSPACE,
  type DocumentWorkspaceConfig,
} from '../constants/documentWorkspaceConfig'
import AccountMappingModal from '../components/AccountMappingModal'
import ErrorMessage from '../components/ErrorMessage'
import ImportSuccessBanner from '../components/supportDocument/ImportSuccessBanner'
import BatchQueueProgressBanner from '../components/supportDocument/BatchQueueProgressBanner'
import SupportDocumentConfigPanel from '../components/supportDocument/SupportDocumentConfigPanel'
import SupportDocumentFilterBar from '../components/supportDocument/SupportDocumentFilterBar'
import SupportDocumentPagination from '../components/supportDocument/SupportDocumentPagination'
import SupportDocumentTable from '../components/supportDocument/SupportDocumentTable'
import { DEFAULT_ELECTRONIC_DOCUMENT_PAGE_SIZE, type ElectronicDocumentPageSize } from '../constants/electronicDocuments'
import { useSiigoWorkspaceCatalog } from '../context/SiigoCatalogContext'
import {
  useSupportDocumentSend,
  type BatchQueueProgress,
} from '../hooks/useSupportDocumentSend'
import { useSupportDocumentResume } from '../hooks/useSupportDocumentResume'
import {
  AUTO_DISMISS_ERROR_MS,
  useAutoDismissMessage,
} from '../hooks/useAutoDismissMessage'
import {
  fetchElectronicDocumentFilterOptions,
  fetchElectronicDocuments,
} from '../services/electronicDocumentService'
import { getApiErrorMessage } from '../services/apiClient'
import { deleteSiigoSupportDocument } from '../services/siigoService'
import type {
  ElectronicDocumentFilterOptions,
  ElectronicDocumentListItem,
} from '../types/electronicDocument'
import type { SupportDocumentImportNotice } from '../types/supportDocumentPage'
import {
  EMPTY_SUPPORT_DOCUMENT_COLUMN_FILTERS,
  type SupportDocumentColumnFilters,
  type SupportDocumentSortColumn,
  type SupportDocumentSortDirection,
} from '../types/supportDocumentTableFilters'
import { detectDocumentSourceType } from '../utils/fileType'
import { mapElectronicDocumentToSupportRow } from '../utils/mapSupportDocumentRow'
import { isSupportDocumentRowSelectable } from '../utils/mapImportRowStatus'
import { IMPORT_ROW_STATUS } from '../types/import'
import {
  buildInitialRowAccounts,
  mergeSuggestedAccountsIntoOptions,
} from '../utils/siigoAccounts'
import { mapSuggestedPaymentMethodToOption } from '../utils/siigoPaymentMethods'
import {
  mapSuggestedCostCenterToOption,
} from '../utils/siigoCostCenters'
import {
  mapSuggestedRetentionsToTaxOptions,
} from '../utils/siigoTaxes'
import {
  buildInitialRowDates,
  buildInitialRowObservations,
} from '../utils/supportDocumentDate'
import {
  canSendDocument,
  countDeletableDocuments,
  countSendableDocuments,
} from '../utils/supportDocumentSend'
import {
  sortSupportDocumentRows,
} from '../utils/filterSupportDocumentRows'
import './SupportDocumentPage.css'
import '../pages/InvoiceUpload.css'

function buildInitialRowCostCenters(
  documents: ElectronicDocumentListItem[],
): Record<string, SiigoCostCenterOption | null> {
  return Object.fromEntries(
    documents.map((document) => [
      document.id,
      mapSuggestedCostCenterToOption(document.suggestedCostCenter),
    ]),
  )
}

function buildInitialRowPaymentMethods(
  documents: ElectronicDocumentListItem[],
): Record<string, SiigoPaymentMethodOption | null> {
  return Object.fromEntries(
    documents.map((document) => [
      document.id,
      mapSuggestedPaymentMethodToOption(document.suggestedPaymentMethod),
    ]),
  )
}

function buildInitialRowRetentions(
  documents: ElectronicDocumentListItem[],
  retentionCatalogTypes: readonly string[],
): Record<string, SiigoTaxOption[]> {
  return Object.fromEntries(
    documents.map((document) => [
      document.id,
      normalizeRetentionsForTypes(
        mapSuggestedRetentionsToTaxOptions(document.suggestedRetentions),
        retentionCatalogTypes,
      ),
    ]),
  )
}

function buildEmptyRetentionsByType(
  retentionCatalogTypes: readonly string[],
): Record<string, SiigoTaxOption | null> {
  return Object.fromEntries(
    retentionCatalogTypes.map((taxType) => [taxType, null]),
  )
}

function resolveSharedSelectionValue<T>(
  selectedIds: Set<string>,
  getValue: (documentId: string) => T | null | undefined,
  isEqual: (left: T, right: T) => boolean,
): T | null {
  const documentIds = [...selectedIds]

  if (documentIds.length === 0) {
    return null
  }

  const firstValue = getValue(documentIds[0])

  if (firstValue == null) {
    return null
  }

  for (const documentId of documentIds.slice(1)) {
    const value = getValue(documentId)

    if (value == null || !isEqual(firstValue, value)) {
      return null
    }
  }

  return firstValue
}


export function DocumentWorkspacePage({ config }: { config: DocumentWorkspaceConfig }) {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const controlsAnchorRef = useRef<HTMLDivElement>(null)
  const [isControlsAnchored, setIsControlsAnchored] = useState(false)
  const [documents, setDocuments] = useState<ElectronicDocumentListItem[]>([])
  const [page, setPage] = useState(1)
  const [pageLimit, setPageLimit] = useState<ElectronicDocumentPageSize>(
    DEFAULT_ELECTRONIC_DOCUMENT_PAGE_SIZE,
  )
  const [totalDocuments, setTotalDocuments] = useState(0)
  const [refreshToken, setRefreshToken] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useAutoDismissMessage(
    AUTO_DISMISS_ERROR_MS,
  )
  const [deleteFeedbackMessage, setDeleteFeedbackMessage] =
    useAutoDismissMessage()
  const [isDeleting, setIsDeleting] = useState(false)
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(
    null,
  )
  const [deleteQueueProgress, setDeleteQueueProgress] =
    useState<BatchQueueProgress | null>(null)
  const [importNotice, setImportNotice] =
    useState<SupportDocumentImportNotice | null>(null)
  const [showImportOnly, setShowImportOnly] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false)
  const [selectedSupplierNits, setSelectedSupplierNits] = useState<string[]>([])
  const [columnFilters, setColumnFilters] =
    useState<SupportDocumentColumnFilters>(EMPTY_SUPPORT_DOCUMENT_COLUMN_FILTERS)
  const [filterOptions, setFilterOptions] =
    useState<ElectronicDocumentFilterOptions | null>(null)
  const [sortColumn, setSortColumn] = useState<SupportDocumentSortColumn | null>(
    'createdAt',
  )
  const [sortDirection, setSortDirection] =
    useState<SupportDocumentSortDirection>('desc')
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<Set<string>>(
    new Set(),
  )
  const {
    accountOptions,
    paymentMethodOptions,
    retentionOptionsByType,
    costCenterOptions,
    accountsError,
    paymentMethodsError,
    costCentersError,
    retentionsError,
  } = useSiigoWorkspaceCatalog(config)
  const [rowAccounts, setRowAccounts] = useState<
    Record<string, SiigoAccountOption | null>
  >({})
  const [rowPaymentMethods, setRowPaymentMethods] = useState<
    Record<string, SiigoPaymentMethodOption | null>
  >({})
  const [rowCostCenters, setRowCostCenters] = useState<
    Record<string, SiigoCostCenterOption | null>
  >({})
  const [rowRetentions, setRowRetentions] = useState<
    Record<string, SiigoTaxOption[]>
  >({})
  const [rowDates, setRowDates] = useState<Record<string, string>>({})
  const [rowObservations, setRowObservations] = useState<Record<string, string>>({})
  const [selectedAccount, setSelectedAccount] = useState<SiigoAccountOption | null>(
    null,
  )
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<SiigoPaymentMethodOption | null>(null)
  const [selectedCostCenter, setSelectedCostCenter] =
    useState<SiigoCostCenterOption>(NONE_COST_CENTER_OPTION)
  const [selectedRetentionsByType, setSelectedRetentionsByType] = useState<
    Record<string, SiigoTaxOption | null>
  >(() => buildEmptyRetentionsByType(config.retentionCatalogTypes))

  const reloadDocuments = useCallback((options?: { resetPage?: boolean }) => {
    if (options?.resetPage) {
      setPage((currentPage) => {
        if (currentPage === 1) {
          setRefreshToken((token) => token + 1)
        }

        return 1
      })
      return
    }

    setRefreshToken((token) => token + 1)
  }, [])

  useEffect(() => {
    let cancelled = false

    void (async () => {
      setIsLoading(true)
      setErrorMessage(null)

      try {
        const response = await fetchElectronicDocuments({
          electronicDocumentType: config.electronicDocumentType,
          page,
          limit: pageLimit,
          supplierNits:
            selectedSupplierNits.length > 0 ? selectedSupplierNits : undefined,
          issueDates:
            columnFilters.dates.length > 0 ? columnFilters.dates : undefined,
          siigoDocumentNumbers:
            columnFilters.siigoNumbers.length > 0
              ? columnFilters.siigoNumbers
              : undefined,
          importStatuses:
            columnFilters.statuses.length > 0
              ? columnFilters.statuses
              : undefined,
        })

        if (cancelled) {
          return
        }

        setDocuments(response.items)
        setTotalDocuments(response.total)
        setPage(response.page)
        setPageLimit(response.limit as ElectronicDocumentPageSize)
        setRowAccounts(buildInitialRowAccounts(response.items))
        setRowPaymentMethods(buildInitialRowPaymentMethods(response.items))
        setRowCostCenters(buildInitialRowCostCenters(response.items))
        setRowRetentions(
          buildInitialRowRetentions(
            response.items,
            config.retentionCatalogTypes,
          ),
        )
        setRowDates((current) =>
          buildInitialRowDates(response.items, current, {
            allowAnyDate: config.provider === 'JARVIS',
          }),
        )
        setRowObservations((current) =>
          buildInitialRowObservations(response.items, current),
        )
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            getApiErrorMessage(
              error,
              config.loadDocumentsError,
            ),
          )
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [
    columnFilters.dates,
    columnFilters.siigoNumbers,
    columnFilters.statuses,
    config.electronicDocumentType,
    config.loadDocumentsError,
    config.provider,
    config.retentionCatalogTypes,
    page,
    pageLimit,
    selectedSupplierNits,
    refreshToken,
  ])

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const options = await fetchElectronicDocumentFilterOptions({
          electronicDocumentType: config.electronicDocumentType,
        })

        if (!cancelled) {
          setFilterOptions(options)
        }
      } catch {
        if (!cancelled) {
          setFilterOptions(null)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [config.electronicDocumentType, refreshToken])

  useEffect(() => {
    const sentinel = controlsAnchorRef.current

    if (!sentinel || selectedDocumentIds.size === 0) {
      setIsControlsAnchored(false)
      return
    }

    const scrollRoot = sentinel.closest(
      '.app-layout__content',
    ) as HTMLElement | null

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsControlsAnchored(!entry.isIntersecting)
      },
      {
        threshold: 0,
        root: scrollRoot,
      },
    )

    observer.observe(sentinel)

    return () => {
      observer.disconnect()
    }
  }, [selectedDocumentIds.size])

  useEffect(() => {
    if (documents.length === 0) {
      return
    }

    setRowAccounts((current) => {
      const resolved = buildInitialRowAccounts(documents, accountOptions)
      let changed = false
      const next = { ...current }

      for (const document of documents) {
        const account = resolved[document.id]

        if (account && !next[document.id]) {
          next[document.id] = account
          changed = true
        }
      }

      return changed ? next : current
    })
  }, [documents, accountOptions])

  const importFilteredDocuments = useMemo(() => {
    if (!showImportOnly || !importNotice) {
      return documents
    }

    const importedIds = new Set(importNotice.documentIds)
    return documents.filter((document) => importedIds.has(document.id))
  }, [documents, importNotice, showImportOnly])

  const filteredDocuments = importFilteredDocuments

  const tableAccountOptions = useMemo(
    () => mergeSuggestedAccountsIntoOptions(accountOptions, filteredDocuments),
    [accountOptions, filteredDocuments],
  )

  const handleRetentionTypeChange = useCallback(
    (taxType: string, tax: SiigoTaxOption | null) => {
      setSelectedRetentionsByType((current) => ({
        ...current,
        [taxType]: tax,
      }))

      if (selectedDocumentIds.size === 0) {
        return
      }

      setRowRetentions((current) => {
        const next = { ...current }

        for (const documentId of selectedDocumentIds) {
          const existing = current[documentId] ?? []
          const withoutType = existing.filter(
            (item) => !retentionTaxTypesMatch(item.type, taxType),
          )
          next[documentId] = tax ? [...withoutType, tax] : withoutType
        }

        return next
      })
    },
    [selectedDocumentIds],
  )

  const {
    importStatuses,
    isResuming,
    isModalOpen,
    errorMessage: resumeErrorMessage,
    accountModal,
    watchImportedDocuments,
    closeAccountModal,
    selectAccount,
    saveAccount,
    retrySaveAccount,
    acceptPurchase,
    setImportStatus,
  } = useSupportDocumentResume({
    electronicDocumentType: config.electronicDocumentType,
    provider: config.provider,
    documents,
    setDocuments,
    onFlowCompleted: () => reloadDocuments({ resetPage: true }),
  })

  const documentsById = useMemo(
    () => Object.fromEntries(documents.map((document) => [document.id, document])),
    [documents],
  )

  const pageTableRows = useMemo(
    () =>
      filteredDocuments.map((document) => {
        const row = mapElectronicDocumentToSupportRow(
          document,
          importStatuses[document.id],
        )

        if (config.provider === 'JARVIS' && row.action === 'delete') {
          return { ...row, action: 'none' as const }
        }

        return row
      }),
    [filteredDocuments, importStatuses, config.provider],
  )

  const tableRows = useMemo(() => {
    return sortSupportDocumentRows(
      pageTableRows,
      sortColumn,
      sortDirection,
      rowDates,
      rowAccounts,
      rowPaymentMethods,
      rowRetentions,
    )
  }, [
    pageTableRows,
    rowAccounts,
    rowDates,
    rowPaymentMethods,
    rowRetentions,
    sortColumn,
    sortDirection,
  ])

  const selectedDocumentIdsKey = useMemo(
    () => [...selectedDocumentIds].sort().join(','),
    [selectedDocumentIds],
  )

  useEffect(() => {
    if (selectedDocumentIds.size === 0) {
      setSelectedAccount(null)
      setSelectedPaymentMethod(null)
      setSelectedCostCenter(NONE_COST_CENTER_OPTION)
      setSelectedRetentionsByType(
        buildEmptyRetentionsByType(config.retentionCatalogTypes),
      )
      return
    }

    setSelectedAccount(
      resolveSharedSelectionValue(
        selectedDocumentIds,
        (documentId) => rowAccounts[documentId] ?? null,
        (left, right) => left.code === right.code,
      ),
    )

    setSelectedPaymentMethod(
      resolveSharedSelectionValue(
        selectedDocumentIds,
        (documentId) => rowPaymentMethods[documentId] ?? null,
        (left, right) => left.id === right.id,
      ),
    )

    const sharedCostCenter = resolveSharedSelectionValue(
      selectedDocumentIds,
      (documentId) => rowCostCenters[documentId] ?? null,
      (left, right) => left.id === right.id,
    )
    setSelectedCostCenter(sharedCostCenter ?? NONE_COST_CENTER_OPTION)

    const sharedRetentions = resolveSharedSelectionValue(
      selectedDocumentIds,
      (documentId) => rowRetentions[documentId] ?? [],
      (left, right) =>
        left.length === right.length &&
        left.every((tax, index) => tax.id === right[index]?.id),
    )

    setSelectedRetentionsByType(
      sharedRetentions
        ? splitRetentionsByTypes(
            sharedRetentions,
            config.retentionCatalogTypes,
          )
        : buildEmptyRetentionsByType(config.retentionCatalogTypes),
    )
  }, [config.retentionCatalogTypes, selectedDocumentIdsKey])

  useEffect(() => {
    setSelectedDocumentIds((current) => {
      if (current.size === 0) {
        return current
      }

      const next = new Set(
        [...current].filter((documentId) => {
          const importStatus = importStatuses[documentId]

          if (!importStatus) {
            return true
          }

          return isSupportDocumentRowSelectable(importStatus)
        }),
      )

      return next.size === current.size ? current : next
    })
  }, [importStatuses])

  const {
    isSending,
    queueProgress: sendQueueProgress,
    feedbackMessage,
    errorMessage: sendErrorMessage,
    sendDocuments,
  } = useSupportDocumentSend({
    workspace: config,
    onCompleted: () => reloadDocuments({ resetPage: true }),
    onDocumentStatusChange: setImportStatus,
  })

  const queueProgress = sendQueueProgress ?? deleteQueueProgress
  const queueProgressTone = sendQueueProgress
    ? 'send'
    : deleteQueueProgress
      ? 'delete'
      : 'send'

  const applySelectionToCheckedRows = useCallback(
    <T,>(
      value: T | null,
      setter: Dispatch<SetStateAction<Record<string, T | null>>>,
    ) => {
      if (!value || selectedDocumentIds.size === 0) {
        return
      }

      setter((current) => {
        const next = { ...current }

        for (const documentId of selectedDocumentIds) {
          next[documentId] = value
        }

        return next
      })
    },
    [selectedDocumentIds],
  )

  const handleConfigAccountChange = useCallback(
    (account: SiigoAccountOption | null) => {
      setSelectedAccount(account)

      if (!account || selectedDocumentIds.size === 0) {
        return
      }

      setRowAccounts((current) => {
        const next = { ...current }

        for (const documentId of selectedDocumentIds) {
          next[documentId] = account
        }

        return next
      })
    },
    [selectedDocumentIds],
  )

  const handleConfigPaymentMethodChange = useCallback(
    (paymentMethod: SiigoPaymentMethodOption | null) => {
      setSelectedPaymentMethod(paymentMethod)
      applySelectionToCheckedRows(paymentMethod, setRowPaymentMethods)
    },
    [applySelectionToCheckedRows],
  )

  const handleConfigCostCenterChange = useCallback(
    (costCenter: SiigoCostCenterOption) => {
      setSelectedCostCenter(costCenter)
      applySelectionToCheckedRows(costCenter, setRowCostCenters)
    },
    [applySelectionToCheckedRows],
  )

  const sendableSelectedCount = useMemo(
    () =>
      countSendableDocuments(
        selectedDocumentIds,
        documentsById,
        importStatuses,
        rowAccounts,
        rowPaymentMethods,
        {
          requiresAccount: config.requiresAccount,
          requiresPaymentMethod: config.requiresPaymentMethod,
        },
      ),
    [
      selectedDocumentIds,
      documentsById,
      importStatuses,
      rowAccounts,
      rowPaymentMethods,
      config.requiresAccount,
      config.requiresPaymentMethod,
    ],
  )

  const deletableSelectedCount = useMemo(
    () =>
      config.provider === 'JARVIS'
        ? 0
        : countDeletableDocuments(selectedDocumentIds, importStatuses),
    [selectedDocumentIds, importStatuses, config.provider],
  )

  const canSendSelected = sendableSelectedCount > 0
  const canDeleteSelected =
    deletableSelectedCount > 0 && sendableSelectedCount === 0

  const canSendRow = useCallback(
    (rowId: string) => {
      const document = documentsById[rowId]

      if (!document) {
        return false
      }

      return canSendDocument(
        document,
        rowId,
        importStatuses[rowId],
        rowAccounts,
        rowPaymentMethods,
        {
          requiresAccount: config.requiresAccount,
          requiresPaymentMethod: config.requiresPaymentMethod,
        },
      )
    },
    [
      documentsById,
      importStatuses,
      rowAccounts,
      rowPaymentMethods,
      config.requiresAccount,
      config.requiresPaymentMethod,
    ],
  )

  const handleSendSelected = useCallback(() => {
    void sendDocuments({
      documentIds: [...selectedDocumentIds],
      documentsById,
      importStatuses,
      rowAccounts,
      rowPaymentMethods,
      rowCostCenters,
      rowRetentions,
      rowDates,
      rowObservations,
    })
  }, [
    documentsById,
    importStatuses,
    rowAccounts,
    rowCostCenters,
    rowDates,
    rowObservations,
    rowPaymentMethods,
    rowRetentions,
    selectedDocumentIds,
    sendDocuments,
  ])

  const handleDeleteSelected = useCallback(async () => {
    const targets = [...selectedDocumentIds].filter(
      (documentId) => importStatuses[documentId] === IMPORT_ROW_STATUS.LISTA,
    )

    if (targets.length === 0) {
      return
    }

    const confirmed = window.confirm(
      targets.length === 1
        ? '¿Eliminar este Documento Soporte en SIIGO? Podrás volver a enviarlo después.'
        : `¿Eliminar ${targets.length} Documentos Soporte en SIIGO? Podrás volver a enviarlos después.`,
    )

    if (!confirmed) {
      return
    }

    setIsDeleting(true)
    setErrorMessage(null)
    setDeleteFeedbackMessage(null)
    setDeleteQueueProgress({
      current: 0,
      total: targets.length,
      completed: 0,
      label: 'Preparando eliminación en SIIGO...',
    })

    let deletedCount = 0
    let failedCount = 0
    let lastError: string | null = null
    let completed = 0
    let started = 0

    const bumpProgress = (label: string) => {
      setDeleteQueueProgress({
        current: Math.min(Math.max(started, completed), targets.length),
        total: targets.length,
        completed,
        label,
      })
    }

    try {
      await Promise.all(
        targets.map(async (documentId, index) => {
          if (index > 0) {
            await new Promise((resolve) => {
              window.setTimeout(resolve, index * 1000)
            })
          }

          started += 1
          setDeletingDocumentId(documentId)
          bumpProgress(`Eliminando… ${completed} de ${targets.length} listos`)

          try {
            await deleteSiigoSupportDocument(documentId)
            setImportStatus(documentId, IMPORT_ROW_STATUS.PENDIENTE)
            deletedCount += 1
          } catch (error) {
            failedCount += 1
            lastError = getApiErrorMessage(
              error,
              'No se pudo eliminar el Documento Soporte en SIIGO.',
            )
          }

          completed += 1
          bumpProgress(
            completed === targets.length
              ? `Completado ${completed} de ${targets.length}`
              : `Eliminando… ${completed} de ${targets.length} listos`,
          )
        }),
      )

      if (deletedCount > 0) {
        setDeleteFeedbackMessage(
          failedCount > 0
            ? `${deletedCount} eliminado(s), ${failedCount} con error.`
            : deletedCount === 1
              ? 'Documento Soporte eliminado en SIIGO.'
              : `${deletedCount} Documentos Soporte eliminados en SIIGO.`,
        )
        reloadDocuments()
      }

      if (failedCount > 0 && deletedCount === 0) {
        setErrorMessage(
          lastError ?? 'No se pudieron eliminar los documentos seleccionados.',
        )
      }
    } finally {
      setIsDeleting(false)
      setDeletingDocumentId(null)
      setDeleteQueueProgress(null)
    }
  }, [
    importStatuses,
    reloadDocuments,
    selectedDocumentIds,
    setDeleteFeedbackMessage,
    setErrorMessage,
    setImportStatus,
  ])

  const handleSendDocument = useCallback(
    (document: ElectronicDocumentListItem) => {
      void sendDocuments({
        documentIds: [document.id],
        documentsById,
        importStatuses,
        rowAccounts,
        rowPaymentMethods,
        rowCostCenters,
        rowRetentions,
        rowDates,
        rowObservations,
      })
    },
    [
      documentsById,
      importStatuses,
      rowAccounts,
      rowCostCenters,
      rowDates,
      rowObservations,
      rowPaymentMethods,
      rowRetentions,
      sendDocuments,
    ],
  )

  const handleDeleteDocument = useCallback(
    async (document: ElectronicDocumentListItem) => {
      const confirmed = window.confirm(
        '¿Eliminar este Documento Soporte en SIIGO? Podrás volver a enviarlo después.',
      )

      if (!confirmed) {
        return
      }

      setIsDeleting(true)
      setDeletingDocumentId(document.id)
      setErrorMessage(null)
      setDeleteFeedbackMessage(null)
      setDeleteQueueProgress({
        current: 1,
        total: 1,
        completed: 0,
        label: 'Eliminando 1 de 1...',
      })

      try {
        await deleteSiigoSupportDocument(document.id)
        setImportStatus(document.id, IMPORT_ROW_STATUS.PENDIENTE)
        setDeleteQueueProgress({
          current: 1,
          total: 1,
          completed: 1,
          label: 'Completado 1 de 1',
        })
        setDeleteFeedbackMessage('Documento Soporte eliminado en SIIGO.')
        reloadDocuments()
      } catch (error) {
        setErrorMessage(
          getApiErrorMessage(
            error,
            'No se pudo eliminar el Documento Soporte en SIIGO.',
          ),
        )
      } finally {
        setIsDeleting(false)
        setDeletingDocumentId(null)
        setDeleteQueueProgress(null)
      }
    },
    [
      reloadDocuments,
      setDeleteFeedbackMessage,
      setErrorMessage,
      setImportStatus,
    ],
  )

  const handleToggleRow = useCallback(
    (documentId: string) => {
      const importStatus = importStatuses[documentId]

      if (importStatus && !isSupportDocumentRowSelectable(importStatus)) {
        return
      }

      setSelectedDocumentIds((current) => {
        const next = new Set(current)

        if (next.has(documentId)) {
          next.delete(documentId)
        } else {
          next.add(documentId)
        }

        return next
      })
    },
    [importStatuses],
  )

  const handleSelectRows = useCallback((documentIds: string[]) => {
    setSelectedDocumentIds(new Set(documentIds))
  }, [])

  const handleSupplierNitsChange = useCallback((nits: string[]) => {
    setSelectedSupplierNits(nits)
    setPage(1)
    setSelectedDocumentIds(new Set())
  }, [])

  const handleColumnFiltersChange = useCallback(
    (
      updater: (
        current: SupportDocumentColumnFilters,
      ) => SupportDocumentColumnFilters,
    ) => {
      setColumnFilters((current) => updater(current))
      setPage(1)
      setSelectedDocumentIds(new Set())
    },
    [],
  )

  const handleSortChange = useCallback((column: SupportDocumentSortColumn) => {
    setSortColumn((currentColumn) => {
      if (currentColumn === column) {
        setSortDirection((currentDirection) =>
          currentDirection === 'asc' ? 'desc' : 'asc',
        )
        return currentColumn
      }

      setSortDirection('asc')
      return column
    })
  }, [])

  const handlePageChange = useCallback((nextPage: number) => {
    setSelectedDocumentIds(new Set())
    setPage(nextPage)
  }, [])

  const handleLimitChange = useCallback((nextLimit: ElectronicDocumentPageSize) => {
    setSelectedDocumentIds(new Set())
    setPage(1)
    setPageLimit(nextLimit)
  }, [])

  const openFilePicker = () => {
    fileInputRef.current?.click()
  }

  const handleDownloadTemplate = () => {
    if (!config.downloadTemplate) {
      return
    }

    void (async () => {
      setIsDownloadingTemplate(true)
      setErrorMessage(null)

      try {
        await config.downloadTemplate!()
      } catch (error) {
        setErrorMessage(
          getApiErrorMessage(error, config.templateDownloadError),
        )
      } finally {
        setIsDownloadingTemplate(false)
      }
    })()
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) return

    if (!detectDocumentSourceType(file)) {
      window.alert('Seleccione un archivo válido para importar.')
      return
    }

    void (async () => {
      setIsImporting(true)
      setErrorMessage(null)

      try {
        const { documentIds, documentCount } = await config.importFile(file)

        for (const documentId of documentIds) {
          setImportStatus(documentId, IMPORT_ROW_STATUS.EN_PROCESO)
        }

        setImportNotice({ documentCount, documentIds })
        setShowImportOnly(true)
        reloadDocuments({ resetPage: true })
        await watchImportedDocuments(documentIds, () =>
          reloadDocuments({ resetPage: false }),
        )
      } catch (error) {
        setErrorMessage(getApiErrorMessage(error, config.importFileError))
      } finally {
        setIsImporting(false)
      }
    })()
  }

  const handleCreateJarvisTercero = useCallback(
    (document: ElectronicDocumentListItem) => {
      const params = new URLSearchParams({
        create: '1',
        document_type: document.supplierDocumentType?.trim() || 'NIT',
        document_number: document.supplierNit?.trim() || '',
        document_id: document.id,
        return_to: '/documento-soporte/masivo',
      })
      navigate(`/terceros?${params.toString()}`)
    },
    [navigate],
  )

  return (
    <main className="support-document-page">
      <header className="support-document-page__header">
        <div>
          <h1>{config.pageTitle}</h1>
          <p>{config.pageDescription}</p>
        </div>

        <div className="support-document-page__header-actions">
          {config.showTemplateDownload && config.downloadTemplate && (
            <button
              type="button"
              className="support-document-page__template-btn"
              onClick={handleDownloadTemplate}
              disabled={isDownloadingTemplate || isImporting}
            >
              {isDownloadingTemplate
                ? config.downloadingTemplateLabel
                : config.templateButtonLabel}
            </button>
          )}

          <button
            type="button"
            className="support-document-page__import-btn"
            onClick={openFilePicker}
            disabled={isImporting}
          >
            <span aria-hidden="true">+</span>
            {isImporting ? config.importingButtonLabel : config.importButtonLabel}
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={config.fileInputAccept}
          hidden
          onChange={handleFileChange}
        />
      </header>

      {importNotice && (
        <ImportSuccessBanner
          notice={importNotice}
          showImportOnly={showImportOnly}
          onShowImportOnly={() => setShowImportOnly(true)}
          onShowAll={() => setShowImportOnly(false)}
          onDismiss={() => {
            setImportNotice(null)
            setShowImportOnly(false)
          }}
        />
      )}

      <div className="support-document-page__alerts">
        {queueProgress && (
          <BatchQueueProgressBanner
            progress={queueProgress}
            tone={queueProgressTone}
          />
        )}
        {feedbackMessage && (
          <p className="support-document-page__feedback" role="status">
            {feedbackMessage}
          </p>
        )}
        {deleteFeedbackMessage && (
          <p className="support-document-page__feedback" role="status">
            {deleteFeedbackMessage}
          </p>
        )}

        {errorMessage && <ErrorMessage message={errorMessage} />}
        {resumeErrorMessage && <ErrorMessage message={resumeErrorMessage} />}
        {sendErrorMessage && <ErrorMessage message={sendErrorMessage} />}
        {accountsError && <ErrorMessage message={accountsError} />}
        {paymentMethodsError && <ErrorMessage message={paymentMethodsError} />}
        {costCentersError && <ErrorMessage message={costCentersError} />}
        {retentionsError && <ErrorMessage message={retentionsError} />}
      </div>

      <div
        ref={controlsAnchorRef}
        className="support-document-page__controls-anchor"
        aria-hidden="true"
      />

      <div
        className={[
          'support-document-page__controls',
          isControlsAnchored ? 'support-document-page__controls--anchored' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <SupportDocumentConfigPanel
          selectedCount={selectedDocumentIds.size}
          sendableCount={sendableSelectedCount}
          deletableCount={deletableSelectedCount}
          accountOptions={tableAccountOptions}
          paymentMethodOptions={paymentMethodOptions}
          costCenterOptions={costCenterOptions}
          retentionCatalogTypes={config.retentionCatalogTypes}
          retentionOptionsByType={retentionOptionsByType}
          selectedRetentionsByType={selectedRetentionsByType}
          selectedAccount={selectedAccount}
          selectedPaymentMethod={selectedPaymentMethod}
          selectedCostCenter={selectedCostCenter}
          showAccountField={config.requiresAccount}
          canSend={canSendSelected}
          canDelete={canDeleteSelected}
          isSending={isSending}
          isDeleting={isDeleting}
          progressLabel={queueProgress?.label ?? null}
          disabled={isLoading || isImporting || isResuming || isModalOpen}
          onAccountChange={handleConfigAccountChange}
          onPaymentMethodChange={handleConfigPaymentMethodChange}
          onCostCenterChange={handleConfigCostCenterChange}
          onRetentionTypeChange={handleRetentionTypeChange}
          onSend={handleSendSelected}
          onDelete={() => {
            void handleDeleteSelected()
          }}
        />
      </div>

      <SupportDocumentFilterBar
        filterOptions={filterOptions}
        columnFilters={columnFilters}
        selectedSupplierNits={selectedSupplierNits}
        disabled={
          isLoading ||
          isImporting ||
          isResuming ||
          isModalOpen ||
          isSending ||
          isDeleting
        }
        onSupplierNitsChange={handleSupplierNitsChange}
        onColumnFiltersChange={handleColumnFiltersChange}
      />

      <SupportDocumentTable
        rows={tableRows}
        selectedIds={selectedDocumentIds}
        rowDates={rowDates}
        rowAccounts={rowAccounts}
        rowPaymentMethods={rowPaymentMethods}
        rowRetentions={rowRetentions}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        isLoading={isLoading}
        isResuming={isResuming}
        isSending={isSending}
        isDeleting={isDeleting}
        deletingDocumentId={deletingDocumentId}
        selectionDisabled={
          isLoading ||
          isImporting ||
          isResuming ||
          isModalOpen ||
          isSending ||
          isDeleting
        }
        sortDisabled={
          isLoading ||
          isImporting ||
          isResuming ||
          isModalOpen ||
          isSending ||
          isDeleting
        }
        canSendRow={canSendRow}
        documentsById={documentsById}
        sendProcessingLabel={
          queueProgress?.label ?? config.sendProcessingLabel
        }
        supplierMissingLabel={config.supplierMissingLabel}
        onToggleRow={handleToggleRow}
        onSelectRows={handleSelectRows}
        onSendDocument={handleSendDocument}
        onDeleteDocument={handleDeleteDocument}
        onCreateSupplier={
          config.provider === 'JARVIS'
            ? handleCreateJarvisTercero
            : undefined
        }
        onSortChange={handleSortChange}
      />

      {config.requiresAccount && (
        <AccountMappingModal
          isOpen={accountModal.isOpen}
          view={accountModal.view}
          selectedAccount={accountModal.selectedAccount}
          createdPurchase={accountModal.createdPurchase}
          errorMessage={accountModal.errorMessage}
          errorPhase={accountModal.errorPhase}
          onCancel={closeAccountModal}
          onSelectAccount={selectAccount}
          onSave={saveAccount}
          onAccept={acceptPurchase}
          onRetry={retrySaveAccount}
        />
      )}

      <SupportDocumentPagination
        page={page}
        limit={pageLimit}
        total={totalDocuments}
        disabled={isLoading || isImporting || isResuming || isSending}
        onPageChange={handlePageChange}
        onLimitChange={handleLimitChange}
      />

      {!isLoading && totalDocuments > 0 && selectedDocumentIds.size > 0 && (
        <p className="support-document-page__count">
          {selectedDocumentIds.size} documento(s) seleccionado(s) en esta página
        </p>
      )}
    </main>
  )
}

export default function SupportDocumentPage({
  config = SUPPORT_DOCUMENT_WORKSPACE,
}: {
  config?: DocumentWorkspaceConfig
}) {
  return <DocumentWorkspacePage config={config} />
}
