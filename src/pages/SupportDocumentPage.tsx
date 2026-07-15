import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import type { SiigoAccountOption } from '../constants/siigoAccountCatalog'
import type { SiigoPaymentMethodOption } from '../constants/siigoPaymentMethodCatalog'
import type { SiigoTaxOption } from '../constants/siigoTaxCatalog'
import {
  SUPPORT_DOCUMENT_PAYMENT_DOCUMENT_TYPE,
  SUPPORT_DOCUMENT_RETE_ICA_TAX_TYPE,
  SUPPORT_DOCUMENT_RETEFUENTE_TAX_TYPE,
} from '../constants/siigoTaxCatalog'
import AccountMappingModal from '../components/AccountMappingModal'
import ErrorMessage from '../components/ErrorMessage'
import ImportSuccessBanner from '../components/supportDocument/ImportSuccessBanner'
import SupportDocumentConfigPanel from '../components/supportDocument/SupportDocumentConfigPanel'
import SupportDocumentPagination from '../components/supportDocument/SupportDocumentPagination'
import SupportDocumentTable from '../components/supportDocument/SupportDocumentTable'
import { ELECTRONIC_DOCUMENTS_PAGE_SIZE } from '../constants/electronicDocuments'
import { useSupportDocumentSend } from '../hooks/useSupportDocumentSend'
import { useSupportDocumentResume } from '../hooks/useSupportDocumentResume'
import {
  AUTO_DISMISS_ERROR_MS,
  useAutoDismissMessage,
} from '../hooks/useAutoDismissMessage'
import { supportDocumentExcelSource } from '../services/documentSources/supportDocumentExcelSource'
import { downloadSupportDocumentTemplate } from '../services/supportDocumentService'
import {
  fetchElectronicDocuments,
} from '../services/electronicDocumentService'
import { fetchSiigoAccounts, fetchSiigoPaymentMethods, fetchSiigoTaxes } from '../services/siigoService'
import { getApiErrorMessage } from '../services/apiClient'
import {
  ELECTRONIC_DOCUMENT_TYPE,
  type ElectronicDocumentListItem,
} from '../types/electronicDocument'
import type { SupportDocumentImportNotice } from '../types/supportDocumentPage'
import {
  EMPTY_SUPPORT_DOCUMENT_COLUMN_FILTERS,
  type SupportDocumentColumnFilters,
  type SupportDocumentSortColumn,
  type SupportDocumentSortDirection,
} from '../types/supportDocumentTableFilters'
import { EXCEL_FILE_INPUT, isExcelFile } from '../utils/fileType'
import { validateSupportDocumentExcelDates } from '../utils/validateSupportDocumentExcel'
import { mapElectronicDocumentToSupportRow } from '../utils/mapSupportDocumentRow'
import { isSupportDocumentRowSelectable } from '../utils/mapImportRowStatus'
import { IMPORT_ROW_STATUS } from '../types/import'
import {
  buildInitialRowAccounts,
  mapCatalogToAccountOptions,
  mergeSuggestedAccountsIntoOptions,
} from '../utils/siigoAccounts'
import { mapCatalogToPaymentMethodOptions, mapSuggestedPaymentMethodToOption } from '../utils/siigoPaymentMethods'
import { extractSupplierOptions, mergeSupplierOptions } from '../utils/supplierOptions'
import {
  mapCatalogToTaxOptions,
  mapSuggestedRetentionsToTaxOptions,
  mergeRetentionTaxOptions,
} from '../utils/siigoTaxes'
import {
  buildInitialRowDates,
} from '../utils/supportDocumentDate'
import { isSupplierReadyInSiigo } from '../utils/supplierSiigoStatus'
import {
  canSendDocument,
  countSendableDocuments,
} from '../utils/supportDocumentSend'
import {
  rowMatchesColumnFilters,
  sortSupportDocumentRows,
} from '../utils/filterSupportDocumentRows'
import './SupportDocumentPage.css'
import '../pages/InvoiceUpload.css'

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
): Record<string, SiigoTaxOption[]> {
  return Object.fromEntries(
    documents.map((document) => [
      document.id,
      mapSuggestedRetentionsToTaxOptions(document.suggestedRetentions),
    ]),
  )
}

function buildInitialRetentionsConfiguredIds(
  documents: ElectronicDocumentListItem[],
): Set<string> {
  return new Set(
    documents
      .filter((document) => (document.suggestedRetentions?.length ?? 0) > 0)
      .map((document) => document.id),
  )
}

function SupportDocumentPage() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const controlsAnchorRef = useRef<HTMLDivElement>(null)
  const [isControlsAnchored, setIsControlsAnchored] = useState(false)
  const [documents, setDocuments] = useState<ElectronicDocumentListItem[]>([])
  const [page, setPage] = useState(1)
  const [totalDocuments, setTotalDocuments] = useState(0)
  const [refreshToken, setRefreshToken] = useState(0)
  const [supplierOptions, setSupplierOptions] = useState<
    ReturnType<typeof extractSupplierOptions>
  >([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useAutoDismissMessage(
    AUTO_DISMISS_ERROR_MS,
  )
  const [importNotice, setImportNotice] =
    useState<SupportDocumentImportNotice | null>(null)
  const [showImportOnly, setShowImportOnly] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false)
  const [selectedSupplierNits, setSelectedSupplierNits] = useState<string[]>([])
  const [columnFilters, setColumnFilters] =
    useState<SupportDocumentColumnFilters>(EMPTY_SUPPORT_DOCUMENT_COLUMN_FILTERS)
  const [sortColumn, setSortColumn] = useState<SupportDocumentSortColumn | null>(
    null,
  )
  const [sortDirection, setSortDirection] =
    useState<SupportDocumentSortDirection>('asc')
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<Set<string>>(
    new Set(),
  )
  const [accountOptions, setAccountOptions] = useState<SiigoAccountOption[]>([])
  const [paymentMethodOptions, setPaymentMethodOptions] = useState<
    SiigoPaymentMethodOption[]
  >([])
  const [reteIcaOptions, setReteIcaOptions] = useState<SiigoTaxOption[]>([])
  const [reteFuenteOptions, setReteFuenteOptions] = useState<SiigoTaxOption[]>([])
  const [rowAccounts, setRowAccounts] = useState<
    Record<string, SiigoAccountOption | null>
  >({})
  const [rowPaymentMethods, setRowPaymentMethods] = useState<
    Record<string, SiigoPaymentMethodOption | null>
  >({})
  const [rowRetentions, setRowRetentions] = useState<
    Record<string, SiigoTaxOption[]>
  >({})
  const [rowDates, setRowDates] = useState<Record<string, string>>({})
  const [retentionsConfiguredIds, setRetentionsConfiguredIds] = useState<
    Set<string>
  >(new Set())
  const [selectedAccount, setSelectedAccount] = useState<SiigoAccountOption | null>(
    null,
  )
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<SiigoPaymentMethodOption | null>(null)
  const [selectedRetentions, setSelectedRetentions] = useState<SiigoTaxOption[]>(
    [],
  )
  const [accountsError, setAccountsError] = useAutoDismissMessage(
    AUTO_DISMISS_ERROR_MS,
  )
  const [paymentMethodsError, setPaymentMethodsError] = useAutoDismissMessage(
    AUTO_DISMISS_ERROR_MS,
  )
  const [retentionsError, setRetentionsError] = useAutoDismissMessage(
    AUTO_DISMISS_ERROR_MS,
  )

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
          electronicDocumentType: ELECTRONIC_DOCUMENT_TYPE.SUPPORT_DOCUMENT,
          page,
          limit: ELECTRONIC_DOCUMENTS_PAGE_SIZE,
          supplierNits:
            selectedSupplierNits.length > 0 ? selectedSupplierNits : undefined,
        })

        if (cancelled) {
          return
        }

        setDocuments(response.items)
        setTotalDocuments(response.total)
        setPage(response.page)
        setSupplierOptions((current) =>
          mergeSupplierOptions(current, response.items),
        )
        setRowAccounts(buildInitialRowAccounts(response.items))
        setRowPaymentMethods(buildInitialRowPaymentMethods(response.items))
        setRowRetentions(buildInitialRowRetentions(response.items))
        setRetentionsConfiguredIds(
          buildInitialRetentionsConfiguredIds(response.items),
        )
        setRowDates((current) => buildInitialRowDates(response.items, current))
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            getApiErrorMessage(
              error,
              'No se pudieron cargar los documentos soporte.',
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
  }, [page, selectedSupplierNits, refreshToken])

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

  useEffect(() => {
    void (async () => {
      try {
        const catalog = await fetchSiigoAccounts()
        setAccountOptions(mapCatalogToAccountOptions(catalog))
      } catch (error) {
        setAccountsError(
          getApiErrorMessage(
            error,
            'No se pudo cargar el catálogo de cuentas contables.',
          ),
        )
      }

      try {
        const paymentMethods = await fetchSiigoPaymentMethods(
          SUPPORT_DOCUMENT_PAYMENT_DOCUMENT_TYPE,
        )
        setPaymentMethodOptions(mapCatalogToPaymentMethodOptions(paymentMethods))
      } catch (error) {
        setPaymentMethodsError(
          getApiErrorMessage(
            error,
            'No se pudo cargar el catálogo de medios de pago.',
          ),
        )
      }

      const retentionLoadErrors: string[] = []
      let reteIcaCatalog: SiigoTaxOption[] = []
      let reteFuenteCatalog: SiigoTaxOption[] = []

      try {
        reteIcaCatalog = mapCatalogToTaxOptions(
          await fetchSiigoTaxes(SUPPORT_DOCUMENT_RETE_ICA_TAX_TYPE),
        )
      } catch (error) {
        retentionLoadErrors.push(
          getApiErrorMessage(error, 'No se pudo cargar el catálogo de ReteICA.'),
        )
      }

      try {
        reteFuenteCatalog = mapCatalogToTaxOptions(
          await fetchSiigoTaxes(SUPPORT_DOCUMENT_RETEFUENTE_TAX_TYPE),
        )
      } catch (error) {
        retentionLoadErrors.push(
          getApiErrorMessage(error, 'No se pudo cargar el catálogo de Retefuente.'),
        )
      }

      setReteIcaOptions(reteIcaCatalog)
      setReteFuenteOptions(reteFuenteCatalog)

      if (retentionLoadErrors.length === 2) {
        setRetentionsError('No se pudieron cargar los catálogos de retenciones.')
      } else if (retentionLoadErrors.length > 0) {
        setRetentionsError(retentionLoadErrors[0])
      }
    })()
  }, [])

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

  const retentionOptions = useMemo(
    () => mergeRetentionTaxOptions(reteIcaOptions, reteFuenteOptions),
    [reteFuenteOptions, reteIcaOptions],
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
    setAutoApply,
    saveAccount,
    retrySaveAccount,
    acceptPurchase,
    setImportStatus,
  } = useSupportDocumentResume({
    documents,
    setDocuments,
    onFlowCompleted: () => reloadDocuments({ resetPage: true }),
  })

  const documentsById = useMemo(
    () => Object.fromEntries(documents.map((document) => [document.id, document])),
    [documents],
  )

  const tableRows = useMemo(() => {
    const mapped = filteredDocuments.map((document) =>
      mapElectronicDocumentToSupportRow(
        document,
        importStatuses[document.id],
      ),
    )

    const filtered = mapped.filter((row) =>
      rowMatchesColumnFilters(
        row,
        columnFilters,
        rowDates,
        rowAccounts,
        rowPaymentMethods,
        rowRetentions,
      ),
    )

    return sortSupportDocumentRows(
      filtered,
      sortColumn,
      sortDirection,
      rowDates,
      rowAccounts,
      rowPaymentMethods,
      rowRetentions,
    )
  }, [
    columnFilters,
    filteredDocuments,
    importStatuses,
    rowAccounts,
    rowDates,
    rowPaymentMethods,
    rowRetentions,
    sortColumn,
    sortDirection,
  ])

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
    feedbackMessage,
    errorMessage: sendErrorMessage,
    sendDocuments,
  } = useSupportDocumentSend({
    onCompleted: () => reloadDocuments({ resetPage: true }),
    onDocumentStatusChange: setImportStatus,
  })

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
          const document = documents.find((item) => item.id === documentId)

          if (document && isSupplierReadyInSiigo(document)) {
            next[documentId] = value
          }
        }

        return next
      })
    },
    [documents, selectedDocumentIds],
  )

  const applyArraySelectionToCheckedRows = useCallback(
    <T,>(
      values: T[],
      setter: Dispatch<SetStateAction<Record<string, T[]>>>,
    ) => {
      if (selectedDocumentIds.size === 0) {
        return
      }

      setter((current) => {
        const next = { ...current }

        for (const documentId of selectedDocumentIds) {
          const document = documents.find((item) => item.id === documentId)

          if (document && isSupplierReadyInSiigo(document)) {
            next[documentId] = values
          }
        }

        return next
      })
    },
    [documents, selectedDocumentIds],
  )

  const markRetentionsConfiguredForSelection = useCallback(() => {
    if (selectedDocumentIds.size === 0) {
      return
    }

    setRetentionsConfiguredIds((current) => {
      const next = new Set(current)

      for (const documentId of selectedDocumentIds) {
        const document = documents.find((item) => item.id === documentId)

        if (document && isSupplierReadyInSiigo(document)) {
          next.add(documentId)
        }
      }

      return next
    })
  }, [documents, selectedDocumentIds])

  const handleConfigAccountChange = useCallback(
    (account: SiigoAccountOption | null) => {
      setSelectedAccount(account)

      if (!account || selectedDocumentIds.size === 0) {
        return
      }

      setRowAccounts((current) => {
        const next = { ...current }

        for (const documentId of selectedDocumentIds) {
          const document = documents.find((item) => item.id === documentId)

          if (document && isSupplierReadyInSiigo(document)) {
            next[documentId] = account
          }
        }

        return next
      })
    },
    [documents, selectedDocumentIds],
  )

  const handleConfigPaymentMethodChange = useCallback(
    (paymentMethod: SiigoPaymentMethodOption | null) => {
      setSelectedPaymentMethod(paymentMethod)
      applySelectionToCheckedRows(paymentMethod, setRowPaymentMethods)
    },
    [applySelectionToCheckedRows],
  )

  const handleConfigRetentionsChange = useCallback(
    (taxes: SiigoTaxOption[]) => {
      setSelectedRetentions(taxes)
      applyArraySelectionToCheckedRows(taxes, setRowRetentions)
      markRetentionsConfiguredForSelection()
    },
    [
      applyArraySelectionToCheckedRows,
      markRetentionsConfiguredForSelection,
    ],
  )

  const sendableSelectedCount = useMemo(
    () =>
      countSendableDocuments(
        selectedDocumentIds,
        documentsById,
        importStatuses,
        rowAccounts,
        rowPaymentMethods,
        retentionsConfiguredIds,
      ),
    [
      selectedDocumentIds,
      documentsById,
      importStatuses,
      rowAccounts,
      rowPaymentMethods,
      retentionsConfiguredIds,
    ],
  )

  const canSendSelected = sendableSelectedCount > 0

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
        retentionsConfiguredIds,
      )
    },
    [
      documentsById,
      importStatuses,
      rowAccounts,
      rowPaymentMethods,
      retentionsConfiguredIds,
    ],
  )

  const handleSendSelected = useCallback(() => {
    void sendDocuments({
      documentIds: [...selectedDocumentIds],
      documentsById,
      importStatuses,
      rowAccounts,
      rowPaymentMethods,
      rowRetentions,
      rowDates,
      retentionsConfiguredIds,
    })
  }, [
    documentsById,
    importStatuses,
    retentionsConfiguredIds,
    rowAccounts,
    rowDates,
    rowPaymentMethods,
    rowRetentions,
    selectedDocumentIds,
    sendDocuments,
  ])

  const handleSendDocument = useCallback(
    (document: ElectronicDocumentListItem) => {
      void sendDocuments({
        documentIds: [document.id],
        documentsById,
        importStatuses,
        rowAccounts,
        rowPaymentMethods,
        rowRetentions,
        rowDates,
        retentionsConfiguredIds,
      })
    },
    [
      documentsById,
      importStatuses,
      retentionsConfiguredIds,
      rowAccounts,
      rowDates,
      rowPaymentMethods,
      rowRetentions,
      sendDocuments,
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

  const openFilePicker = () => {
    fileInputRef.current?.click()
  }

  const handleDownloadTemplate = () => {
    void (async () => {
      setIsDownloadingTemplate(true)
      setErrorMessage(null)

      try {
        await downloadSupportDocumentTemplate()
      } catch (error) {
        setErrorMessage(
          getApiErrorMessage(
            error,
            'No se pudo descargar la plantilla de Documento soporte.',
          ),
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

    if (!isExcelFile(file)) {
      window.alert('Solo se permiten archivos Excel (.xlsx, .xls).')
      return
    }

    void (async () => {
      setIsImporting(true)
      setErrorMessage(null)

      try {
        await validateSupportDocumentExcelDates(file)

        const { rawResponse } = await supportDocumentExcelSource.upload(file, {
          electronicDocumentType: ELECTRONIC_DOCUMENT_TYPE.SUPPORT_DOCUMENT,
        })
        const response = rawResponse as {
          documentsCreated?: number
          documentIds?: string[]
        }
        const documentIds = response.documentIds ?? []
        const documentCount = response.documentsCreated ?? documentIds.length

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
        setErrorMessage(
          getApiErrorMessage(error, 'No se pudo importar el archivo Excel.'),
        )
      } finally {
        setIsImporting(false)
      }
    })()
  }

  return (
    <main className="support-document-page">
      <header className="support-document-page__header">
        <div>
          <h1>Documento Soporte</h1>
          <p>Descarga la plantilla Excel, completa tus datos e impórtalos aquí.</p>
        </div>

        <div className="support-document-page__header-actions">
          <button
            type="button"
            className="support-document-page__template-btn"
            onClick={handleDownloadTemplate}
            disabled={isDownloadingTemplate || isImporting}
          >
            {isDownloadingTemplate ? 'Descargando...' : 'Descargar plantilla'}
          </button>

          <button
            type="button"
            className="support-document-page__import-btn"
            onClick={openFilePicker}
            disabled={isImporting}
          >
            <span aria-hidden="true">+</span>
            {isImporting ? 'Importando...' : 'Importar Excel'}
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={EXCEL_FILE_INPUT}
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
        {feedbackMessage && (
          <p className="support-document-page__feedback" role="status">
            {feedbackMessage}
          </p>
        )}

        {errorMessage && <ErrorMessage message={errorMessage} />}
        {resumeErrorMessage && <ErrorMessage message={resumeErrorMessage} />}
        {sendErrorMessage && <ErrorMessage message={sendErrorMessage} />}
        {accountsError && <ErrorMessage message={accountsError} />}
        {paymentMethodsError && <ErrorMessage message={paymentMethodsError} />}
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
          accountOptions={tableAccountOptions}
          paymentMethodOptions={paymentMethodOptions}
          retentionOptions={retentionOptions}
          selectedAccount={selectedAccount}
          selectedPaymentMethod={selectedPaymentMethod}
          selectedRetentions={selectedRetentions}
          canSend={canSendSelected}
          isSending={isSending}
          disabled={isLoading || isImporting || isResuming || isModalOpen}
          onAccountChange={handleConfigAccountChange}
          onPaymentMethodChange={handleConfigPaymentMethodChange}
          onRetentionsChange={handleConfigRetentionsChange}
          onSend={handleSendSelected}
        />
      </div>

      <SupportDocumentTable
        rows={tableRows}
        selectedIds={selectedDocumentIds}
        rowDates={rowDates}
        rowAccounts={rowAccounts}
        rowPaymentMethods={rowPaymentMethods}
        rowRetentions={rowRetentions}
        supplierOptions={supplierOptions}
        selectedSupplierNits={selectedSupplierNits}
        columnFilters={columnFilters}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        isLoading={isLoading}
        isResuming={isResuming}
        isSending={isSending}
        selectionDisabled={
          isLoading ||
          isImporting ||
          isResuming ||
          isModalOpen ||
          isSending
        }
        filtersDisabled={
          isLoading || isImporting || isResuming || isModalOpen || isSending
        }
        canSendRow={canSendRow}
        documentsById={documentsById}
        onToggleRow={handleToggleRow}
        onSelectRows={handleSelectRows}
        onSendDocument={handleSendDocument}
        onSupplierNitsChange={handleSupplierNitsChange}
        onColumnFiltersChange={handleColumnFiltersChange}
        onSortChange={handleSortChange}
      />

      <AccountMappingModal
        isOpen={accountModal.isOpen}
        view={accountModal.view}
        selectedAccount={accountModal.selectedAccount}
        autoApply={accountModal.autoApply}
        createdPurchase={accountModal.createdPurchase}
        errorMessage={accountModal.errorMessage}
        errorPhase={accountModal.errorPhase}
        onCancel={closeAccountModal}
        onSelectAccount={selectAccount}
        onAutoApplyChange={setAutoApply}
        onSave={saveAccount}
        onAccept={acceptPurchase}
        onRetry={retrySaveAccount}
      />

      <SupportDocumentPagination
        page={page}
        limit={ELECTRONIC_DOCUMENTS_PAGE_SIZE}
        total={totalDocuments}
        disabled={isLoading || isImporting || isResuming || isSending}
        onPageChange={handlePageChange}
      />

      {!isLoading && totalDocuments > 0 && selectedDocumentIds.size > 0 && (
        <p className="support-document-page__count">
          {selectedDocumentIds.size} documento(s) seleccionado(s) en esta página
        </p>
      )}
    </main>
  )
}

export default SupportDocumentPage
