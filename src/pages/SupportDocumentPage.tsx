import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
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
  type DocumentWorkspaceProvider,
} from '../constants/documentWorkspaceConfig'
import AccountMappingModal from '../components/AccountMappingModal'
import Button from '../components/Button'
import ConfirmDialog from '../components/ConfirmDialog'
import CreateJarvisTerceroModal from '../components/CreateJarvisTerceroModal'
import ErrorMessage from '../components/ErrorMessage'
import PageHeader from '../components/PageHeader'
import ImportLoadingOverlay from '../components/supportDocument/ImportLoadingOverlay'
import PurchaseInvoiceImportProgress from '../components/supportDocument/PurchaseInvoiceImportProgress'
import ImportSuccessBanner from '../components/supportDocument/ImportSuccessBanner'
import BatchQueueProgressBanner from '../components/supportDocument/BatchQueueProgressBanner'
import SendSuccessBanner from '../components/supportDocument/SendSuccessBanner'
import SupportDocumentConfigPanel from '../components/supportDocument/SupportDocumentConfigPanel'
import SupportDocumentFilterBar from '../components/supportDocument/SupportDocumentFilterBar'
import SupportDocumentPagination from '../components/supportDocument/SupportDocumentPagination'
import SupportDocumentTable from '../components/supportDocument/SupportDocumentTable'
import {
  getStoredElectronicDocumentPageLimit,
  setStoredElectronicDocumentPageLimit,
  type ElectronicDocumentPageSize,
} from '../constants/electronicDocuments'
import { useSiigoWorkspaceCatalog } from '../context/SiigoCatalogContext'
import { useIntegrationSetup } from '../context/IntegrationSetupContext'
import {
  useSupportDocumentSend,
  type BatchQueueProgress,
} from '../hooks/useSupportDocumentSend'
import { useSupportDocumentResume } from '../hooks/useSupportDocumentResume'
import { useLatestPurchaseInvoiceImportJob } from '../hooks/usePurchaseInvoiceImportJobs'
import {
  AUTO_DISMISS_CONFIRMATION_MS,
  AUTO_DISMISS_ERROR_MS,
  useAutoDismissMessage,
} from '../hooks/useAutoDismissMessage'
import { retryFailedPurchaseInvoiceImportRows } from '../services/documentSources/purchaseInvoiceExcelSource'
import { waitForTerminalStatus } from '../services/realtime/purchaseInvoiceImportJobsStore'
import {
  deleteElectronicDocument,
  deleteElectronicDocumentsBatch,
  fetchElectronicDocumentFilterOptions,
  fetchElectronicDocuments,
  peekElectronicDocuments,
} from '../services/electronicDocumentService'
import { getApiErrorMessage } from '../services/apiClient'
import { requestAiPurchaseSuggestion } from '../services/aiSuggestionService'
import { fetchAutoCreatedSuppliers } from '../services/siigoService'
import type {
  ElectronicDocumentFilterOptions,
  ElectronicDocumentListItem,
} from '../types/electronicDocument'
import type {
  SupportDocumentImportNotice,
  SupportDocumentSendNotice,
} from '../types/supportDocumentPage'
import type { PurchaseInvoiceItemDraft } from '../types/purchaseInvoiceItemDraft'
import { buildPurchaseInvoiceItemDrafts } from '../types/purchaseInvoiceItemDraft'
import type { PurchaseInvoiceDetailEditorSave } from '../components/supportDocument/PurchaseInvoiceDetailEditor'
import {
  EMPTY_SUPPORT_DOCUMENT_COLUMN_FILTERS,
  type SupportDocumentColumnFilters,
  type SupportDocumentSortColumn,
  type SupportDocumentSortDirection,
} from '../types/supportDocumentTableFilters'
import { detectDocumentSourceType } from '../utils/fileType'
import { mapElectronicDocumentToSupportRow } from '../utils/mapSupportDocumentRow'
import {
  getSupportDocumentActionFromImportStatus,
  isSupportDocumentRowSelectable,
} from '../utils/mapImportRowStatus'
import { IMPORT_ROW_STATUS, type ImportRowStatus } from '../types/import'
import {
  buildInitialRowAccounts,
  mergeSuggestedAccountsIntoOptions,
} from '../utils/siigoAccounts'
import {
  isCreditPaymentMethod,
  mapSuggestedPaymentMethodToOption,
} from '../utils/siigoPaymentMethods'
import {
  mapSuggestedCostCenterToOption,
} from '../utils/siigoCostCenters'
import {
  mapSuggestedRetentionsToTaxOptions,
} from '../utils/siigoTaxes'
import {
  addDaysToLocalDate,
  buildInitialRowDates,
  buildInitialRowDueDates,
  buildInitialRowObservations,
  daysBetweenLocalDates,
  getTodayLocalDate,
} from '../utils/supportDocumentDate'
import {
  canSendDocument,
  countDeletableDocuments,
  countSendableDocuments,
  isDocumentDeletable,
  isDocumentDeletableFromSiigo,
  isDocumentRemovableFromDatabase,
  needsPurchaseInvoiceReview,
} from '../utils/supportDocumentSend'
import {
  sortSupportDocumentRows,
} from '../utils/filterSupportDocumentRows'
import './SupportDocumentPage.css'
import '../pages/InvoiceUpload.css'

/** Copy de las etapas largas (importar, revisar proveedores/terceros, enviar)
 * para el loader de pantalla completa. Listas fijas a nivel de módulo — así
 * la referencia no cambia entre renders y la rotación de mensajes no se
 * reinicia sola. */
const IMPORT_STAGE_TIPS = [
  'Leyendo el archivo Excel...',
  'Creando los documentos...',
  'Preparando la validación...',
]

const RESUMING_STAGE_TIPS: Record<DocumentWorkspaceProvider, string[]> = {
  SIIGO: [
    'Consultando si el proveedor ya existe en SIIGO...',
    'Validando cada documento importado...',
    'Actualizando el estado de la tabla...',
    'Esto puede tomar unos segundos...',
  ],
  JARVIS: [
    'Consultando si el tercero ya existe en Jarvis...',
    'Validando cada documento importado...',
    'Actualizando el estado de la tabla...',
    'Esto puede tomar unos segundos...',
  ],
}

function buildResumingStageTitle(provider: DocumentWorkspaceProvider): string {
  return provider === 'JARVIS' ? 'Revisando terceros' : 'Revisando proveedores'
}

function buildSendingStageTitle(provider: DocumentWorkspaceProvider): string {
  return provider === 'JARVIS' ? 'Enviando a Jarvis' : 'Enviando a SIIGO'
}

function buildInitialRowCostCenters(
  documents: ElectronicDocumentListItem[],
  current: Record<string, SiigoCostCenterOption | null> = {},
): Record<string, SiigoCostCenterOption | null> {
  return Object.fromEntries(
    documents.map((document) => [
      document.id,
      current[document.id] !== undefined
        ? current[document.id]
        : mapSuggestedCostCenterToOption(document.suggestedCostCenter),
    ]),
  )
}

function buildInitialRowPaymentMethods(
  documents: ElectronicDocumentListItem[],
  current: Record<string, SiigoPaymentMethodOption | null> = {},
): Record<string, SiigoPaymentMethodOption | null> {
  return Object.fromEntries(
    documents.map((document) => [
      document.id,
      current[document.id] !== undefined
        ? current[document.id]
        : mapSuggestedPaymentMethodToOption(document.suggestedPaymentMethod),
    ]),
  )
}

function buildInitialRowRetentions(
  documents: ElectronicDocumentListItem[],
  retentionCatalogTypes: readonly string[],
  current: Record<string, SiigoTaxOption[]> = {},
): Record<string, SiigoTaxOption[]> {
  return Object.fromEntries(
    documents.map((document) => [
      document.id,
      current[document.id] !== undefined
        ? current[document.id]
        : normalizeRetentionsForTypes(
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

/** IVA sugerido a nivel documento: solo si todos los ítems coinciden en el
 * mismo impuesto sugerido (si no, se deja en blanco para que el usuario
 * elija). Punto de partida editable, igual que las retenciones. */
function resolveDocumentSuggestedIva(
  document: ElectronicDocumentListItem,
): SiigoTaxOption | null {
  const items = document.items ?? []
  const first = items[0]?.suggestedTax

  if (!first || !items.every((item) => item.suggestedTax?.id === first.id)) {
    return null
  }

  return {
    id: first.id,
    name: first.name,
    type: 'IVA',
    percentage: first.percentage,
  }
}

function buildInitialRowIva(
  documents: ElectronicDocumentListItem[],
  current: Record<string, SiigoTaxOption | null> = {},
): Record<string, SiigoTaxOption | null> {
  return Object.fromEntries(
    documents.map((document) => [
      document.id,
      current[document.id] !== undefined
        ? current[document.id]
        : resolveDocumentSuggestedIva(document),
    ]),
  )
}

/** Descuento general de Factura de compra: arranca en el valor certificado
 * por la DIAN (`document.documentDiscount`) mientras el contador no lo haya
 * editado a mano en el panel de detalle. */
function buildInitialRowDocumentDiscounts(
  documents: ElectronicDocumentListItem[],
  current: Record<string, number> = {},
): Record<string, number> {
  return Object.fromEntries(
    documents.map((document) => [
      document.id,
      current[document.id] !== undefined
        ? current[document.id]
        : (document.documentDiscount ?? 0),
    ]),
  )
}

/** Factura de compra (temporal): todavía no se autorrellena centro de costo
 * desde la preferencia histórica del proveedor — solo lo que viene
 * directamente del response de la factura. Se deja en blanco si el usuario
 * no lo ha elegido/guardado ya. (Cuenta contable y medio de pago sí se
 * autorrellenan — ver buildInitialPurchaseInvoiceRowAccounts y
 * buildInitialPurchaseInvoiceRowPaymentMethods — cada uno según la
 * variabilidad de SU PROPIO campo en el historial del proveedor.) */
function buildBlankRow<T>(
  documents: ElectronicDocumentListItem[],
  blankValue: T,
  current: Record<string, T> = {},
): Record<string, T> {
  return Object.fromEntries(
    documents.map((document) => [
      document.id,
      current[document.id] !== undefined ? current[document.id] : blankValue,
    ]),
  )
}

/** Factura de compra: si el proveedor (por NIT) tiene la cuenta contable fija
 * en su historial de compras, la "Cuenta contable" del documento arranca
 * precargada con esa cuenta — es la que usan los ítems con tipo 'Account' al
 * enviar (ver buildSiigoPurchaseSendRequest). `suggestedItemConfig.accountCode`
 * se evalúa de forma independiente del resto de campos (medio de pago, IVA,
 * etc.): un proveedor puede tener la cuenta fija aunque su medio de pago
 * varíe, y viceversa. Si no hay cuenta confiable en el historial, cae a la
 * sugerida por IA (document.suggestedAccount — ver
 * SiigoPurchaseAiClassificationService en el backend) antes de dejarla
 * vacía: sin este fallback, el ítem mostraba la cuenta de la IA (ver
 * buildPurchaseInvoiceItemDrafts) pero el botón "Enviar" seguía deshabilitado
 * porque ESTE estado nunca se enteraba de esa sugerencia (bug real
 * reportado: cuenta visible en el ítem, pero "Enviar" nunca se habilitaba). */
function buildInitialPurchaseInvoiceRowAccounts(
  documents: ElectronicDocumentListItem[],
  current: Record<string, SiigoAccountOption | null> = {},
): Record<string, SiigoAccountOption | null> {
  return Object.fromEntries(
    documents.map((document) => {
      if (current[document.id] !== undefined) {
        return [document.id, current[document.id]]
      }

      const accountCode =
        document.suggestedItemConfig?.accountCode || document.suggestedAccount?.code
      const accountName =
        document.suggestedItemConfig?.accountCode
          ? (document.suggestedItemConfig.accountName ?? accountCode)
          : (document.suggestedAccount?.name ?? accountCode)

      return [
        document.id,
        accountCode
          ? {
              code: accountCode,
              description: accountName ?? accountCode,
            }
          : null,
      ]
    }),
  )
}

/** Factura de compra: si el medio de pago del proveedor es fijo en su
 * historial, arranca precargado con el que usa casi siempre — si es de
 * crédito, esto hace que el editor muestre Plazo/Fecha de vencimiento sin
 * que el usuario tenga que elegirlo a mano primero. Se evalúa de forma
 * independiente de la cuenta contable y demás campos (ver
 * buildInitialPurchaseInvoiceRowAccounts): el medio de pago puede ser
 * variable aunque la cuenta sea fija.
 *
 * Si el proveedor es nuevo (sin historial propio), cae a
 * `document.suggestedPaymentMethod` — que en el backend ya prueba, en
 * orden: el medio de pago dominante de la CUENTA sugerida (sin importar el
 * proveedor, ver findDominantPaymentMethodByCuenta) y luego el fallback
 * genérico por contado/crédito — antes de dejarlo vacío. Bug real
 * reportado: un proveedor nuevo (D1 SAS) sin historial propio, cuya cuenta
 * sugerida ("Elementos de aseo y Cafetería") sí tiene medio de pago
 * dominante en el histórico de OTROS proveedores, seguía mostrando el
 * campo vacío porque este initializer nunca miraba ese campo. */
function buildInitialPurchaseInvoiceRowPaymentMethods(
  documents: ElectronicDocumentListItem[],
  current: Record<string, SiigoPaymentMethodOption | null> = {},
): Record<string, SiigoPaymentMethodOption | null> {
  return Object.fromEntries(
    documents.map((document) => {
      if (current[document.id] !== undefined) {
        return [document.id, current[document.id]]
      }

      const paymentMethod =
        document.suggestedItemConfig?.paymentMethod ??
        document.suggestedPaymentMethod

      return [
        document.id,
        paymentMethod
          ? {
              id: paymentMethod.id,
              name: paymentMethod.name,
              type: paymentMethod.type,
              dueDate: paymentMethod.dueDate,
            }
          : null,
      ]
    }),
  )
}

/** Factura de compra: las observaciones siempre arrancan con el CUFE (y las
 * notas de la factura si trae), no solo cuando el campo está vacío. Si ya
 * hay un valor guardado (edición previa del usuario o de una carga
 * anterior) pero no incluye el CUFE, se lo antepone igual — el CUFE nunca
 * debe desaparecer en un recargo, ni siquiera si algo dejó guardado solo
 * las notas en algún momento anterior. */
function buildInitialPurchaseInvoiceRowObservations(
  documents: ElectronicDocumentListItem[],
  current: Record<string, string> = {},
): Record<string, string> {
  return Object.fromEntries(
    documents.map((document) => {
      const cufe = document.cufe?.trim()
      const notes = document.observations?.trim() || ''
      const withCufe = cufe ? `CUFE: ${cufe}${notes ? ` - ${notes}` : ''}` : notes

      const existing = current[document.id]
      if (existing === undefined) {
        return [document.id, withCufe]
      }

      if (cufe && !existing.includes(cufe)) {
        return [document.id, `CUFE: ${cufe}${existing ? ` - ${existing}` : ''}`]
      }

      return [document.id, existing]
    }),
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
  const { refreshSetupStatus } = useIntegrationSetup()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const controlsAnchorRef = useRef<HTMLDivElement>(null)
  const [isControlsAnchored, setIsControlsAnchored] = useState(false)
  const [documents, setDocuments] = useState<ElectronicDocumentListItem[]>([])
  const [page, setPage] = useState(1)
  const [pageLimit, setPageLimit] = useState<ElectronicDocumentPageSize>(
    getStoredElectronicDocumentPageLimit,
  )
  const [totalDocuments, setTotalDocuments] = useState(0)
  const [refreshToken, setRefreshToken] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useAutoDismissMessage(
    AUTO_DISMISS_ERROR_MS,
  )
  const [deleteFeedbackMessage, setDeleteFeedbackMessage] =
    useAutoDismissMessage(AUTO_DISMISS_CONFIRMATION_MS)
  const [autoCreatedSuppliersMessage, setAutoCreatedSuppliersMessage] =
    useAutoDismissMessage()
  const [isSuggestingAi, setIsSuggestingAi] = useState(false)
  const [aiSuggestionMessage, setAiSuggestionMessage] = useAutoDismissMessage()
  const [aiSuggestionError, setAiSuggestionError] = useAutoDismissMessage(
    AUTO_DISMISS_ERROR_MS,
  )
  const [isDeleting, setIsDeleting] = useState(false)
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(
    null,
  )
  const [deleteQueueProgress, setDeleteQueueProgress] =
    useState<BatchQueueProgress | null>(null)
  const [pendingDelete, setPendingDelete] = useState<
    | { kind: 'selected'; targets: string[] }
    | { kind: 'single'; document: ElectronicDocumentListItem }
    | null
  >(null)
  const [importNotice, setImportNotice] =
    useState<SupportDocumentImportNotice | null>(null)
  const [showImportOnly, setShowImportOnly] = useState(false)
  const [sendNotice, setSendNotice] =
    useState<SupportDocumentSendNotice | null>(null)
  const [showSendOnly, setShowSendOnly] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [purchaseInvoiceRetryInfo, setPurchaseInvoiceRetryInfo] = useState<{
    jobId: string
    errorCount: number
  } | null>(null)
  const [isRetryingFailedImportRows, setIsRetryingFailedImportRows] =
    useState(false)
  const latestPurchaseInvoiceImportJob = useLatestPurchaseInvoiceImportJob()
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false)
  const [terceroModalDocument, setTerceroModalDocument] =
    useState<ElectronicDocumentListItem | null>(null)
  const [selectedSupplierNits, setSelectedSupplierNits] = useState<string[]>([])
  const [columnFilters, setColumnFilters] =
    useState<SupportDocumentColumnFilters>(EMPTY_SUPPORT_DOCUMENT_COLUMN_FILTERS)
  const [filterOptions, setFilterOptions] =
    useState<ElectronicDocumentFilterOptions | null>(null)
  const [sortColumn, setSortColumn] = useState<SupportDocumentSortColumn | null>(
    config.key === 'purchaseInvoice' ? 'date' : 'createdAt',
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
    ivaOptions,
    costCenterOptions,
    productOptions,
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
  const [rowIva, setRowIva] = useState<Record<string, SiigoTaxOption | null>>({})
  const [rowDocumentDiscounts, setRowDocumentDiscounts] = useState<
    Record<string, number>
  >({})
  const [rowItems, setRowItems] = useState<
    Record<string, PurchaseInvoiceItemDraft[]>
  >({})
  const [rowDates, setRowDates] = useState<Record<string, string>>({})
  const [rowDueDates, setRowDueDates] = useState<Record<string, string | null>>({})
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
  const [selectedIva, setSelectedIva] = useState<SiigoTaxOption | null>(null)
  const [selectedDueDate, setSelectedDueDate] = useState<string>('')

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
      const requestFilters = {
        electronicDocumentType: config.electronicDocumentType,
        page,
        limit: pageLimit,
        supplierNits:
          selectedSupplierNits.length > 0 ? selectedSupplierNits : undefined,
        issueDates:
          columnFilters.dates.length > 0 ? columnFilters.dates : undefined,
        issueDateFrom: columnFilters.dateFrom || undefined,
        issueDateTo: columnFilters.dateTo || undefined,
        siigoDocumentNumbers:
          columnFilters.siigoNumbers.length > 0
            ? columnFilters.siigoNumbers
            : undefined,
        importStatuses:
          columnFilters.statuses.length > 0
            ? // "Requiere revisión" y "Existente en SIIGO" no existen como
              // estado en el backend (se derivan en el frontend, ver
              // pageTableRows más abajo) — se traducen a su estado real de
              // backend (Pendiente/Lista) para el filtro server-side, y el
              // recorte fino a solo las filas que de verdad matchean se hace
              // en el cliente (ver tableRows).
              Array.from(
                new Set(
                  columnFilters.statuses.map((status) => {
                    if (status === IMPORT_ROW_STATUS.REQUIERE_REVISION) {
                      return IMPORT_ROW_STATUS.PENDIENTE
                    }
                    if (status === IMPORT_ROW_STATUS.EXISTENTE_EN_SIIGO) {
                      return IMPORT_ROW_STATUS.LISTA
                    }
                    return status
                  }),
                ),
              )
            : undefined,
      }

      const applyResponse = (
        response: Awaited<ReturnType<typeof fetchElectronicDocuments>>,
      ) => {
        setDocuments(response.items)
        setTotalDocuments(response.total)
        setPage(response.page)
        setPageLimit(response.limit as ElectronicDocumentPageSize)
        const isPurchaseInvoiceWorkspace = config.key === 'purchaseInvoice'

        setRowAccounts((current) =>
          isPurchaseInvoiceWorkspace
            ? buildInitialPurchaseInvoiceRowAccounts(response.items, current)
            : buildInitialRowAccounts(response.items, [], current),
        )
        setRowPaymentMethods((current) =>
          isPurchaseInvoiceWorkspace
            ? buildInitialPurchaseInvoiceRowPaymentMethods(
                response.items,
                current,
              )
            : buildInitialRowPaymentMethods(response.items, current),
        )
        setRowCostCenters((current) =>
          isPurchaseInvoiceWorkspace
            ? buildBlankRow(response.items, null, current)
            : buildInitialRowCostCenters(response.items, current),
        )
        setRowRetentions((current) =>
          isPurchaseInvoiceWorkspace
            ? buildBlankRow<SiigoTaxOption[]>(response.items, [], current)
            : buildInitialRowRetentions(
                response.items,
                config.retentionCatalogTypes,
                current,
              ),
        )
        setRowIva((current) => buildInitialRowIva(response.items, current))
        setRowDocumentDiscounts((current) =>
          buildInitialRowDocumentDiscounts(response.items, current),
        )
        setRowDates((current) =>
          buildInitialRowDates(response.items, current, {
            // La ventana de 5 días hacia atrás es una restricción de SIIGO
            // para CREAR un Documento Soporte nuevo — no aplica a Factura de
            // compra, donde la fecha es la de una factura de tercero ya
            // emitida (puede ser de hace meses).
            allowAnyDate:
              config.provider === 'JARVIS' || config.key === 'purchaseInvoice',
          }),
        )
        setRowObservations((current) =>
          isPurchaseInvoiceWorkspace
            ? buildInitialPurchaseInvoiceRowObservations(response.items, current)
            : buildInitialRowObservations(response.items, current),
        )
        setRowDueDates((current) =>
          buildInitialRowDueDates(response.items, current),
        )
      }

      const cached = peekElectronicDocuments(requestFilters)
      if (cached) {
        applyResponse(cached)
        setIsLoading(false)
        setErrorMessage(null)
      } else {
        setIsLoading(true)
        setErrorMessage(null)
      }

      try {
        const response = await fetchElectronicDocuments(requestFilters)

        if (cancelled) {
          return
        }

        applyResponse(response)
      } catch (error) {
        if (!cancelled && !cached) {
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
    columnFilters.dateFrom,
    columnFilters.dateTo,
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
    if (documents.length === 0 || config.key === 'purchaseInvoice') {
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
  }, [documents, accountOptions, config.key])

  useEffect(() => {
    const catalogById = new Map<number, SiigoTaxOption>()

    for (const options of Object.values(retentionOptionsByType)) {
      for (const tax of options) {
        catalogById.set(tax.id, tax)
      }
    }

    if (catalogById.size === 0) {
      return
    }

    setRowRetentions((current) => {
      let changed = false
      const next: Record<string, SiigoTaxOption[]> = { ...current }

      for (const [documentId, retentions] of Object.entries(current)) {
        if (!retentions.length) {
          continue
        }

        const reconciled = retentions
          .map((retention) => catalogById.get(retention.id))
          .filter((tax): tax is SiigoTaxOption => Boolean(tax))

        if (
          reconciled.length !== retentions.length ||
          reconciled.some((tax, index) => tax.id !== retentions[index]?.id)
        ) {
          next[documentId] = normalizeRetentionsForTypes(
            reconciled,
            config.retentionCatalogTypes,
          )
          changed = true
        }
      }

      return changed ? next : current
    })
  }, [retentionOptionsByType, config.retentionCatalogTypes])

  const filteredDocuments = useMemo(() => {
    if (showImportOnly && importNotice) {
      const importedIds = new Set(importNotice.documentIds)
      return documents.filter((document) => importedIds.has(document.id))
    }

    if (showSendOnly && sendNotice) {
      const sentIds = new Set(sendNotice.documentIds)
      return documents.filter((document) => sentIds.has(document.id))
    }

    return documents
  }, [documents, importNotice, showImportOnly, sendNotice, showSendOnly])

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

  /** Factura de compra SIIGO: `rowItems[id]` solo se llena cuando el usuario
   * despliega el detalle del documento y guarda (ver handleSaveRowEdits) —
   * pero la cuenta/producto de cada ítem ya puede venir resuelta desde antes
   * (regla del proveedor, historial o IA, ver buildPurchaseInvoiceItemDrafts)
   * sin que el usuario haya tenido que abrir nada. Sin este fallback,
   * canSendRow/sendDocuments veían `rowItems[id]` como vacío y el botón
   * "Enviar" quedaba deshabilitado (o el envío perdía el código por ítem)
   * aunque el documento ya tuviera todo lo necesario — bug real reportado:
   * "si no se ha desplegado el detalle del registro, no se habilita enviar".
   * Mismo fallback que ya usa pageTableRows más abajo para decidir
   * "Requiere revisión", así que el botón queda consistente con el estado
   * mostrado en la fila. */
  const effectiveRowItems = useMemo(() => {
    if (config.key !== 'purchaseInvoice' || config.provider !== 'SIIGO') {
      return rowItems
    }

    const merged: Record<string, PurchaseInvoiceItemDraft[]> = { ...rowItems }

    for (const document of documents) {
      if (merged[document.id] === undefined) {
        merged[document.id] = buildPurchaseInvoiceItemDrafts(
          document,
          accountOptions,
          productOptions,
        )
      }
    }

    return merged
  }, [
    config.key,
    config.provider,
    documents,
    rowItems,
    accountOptions,
    productOptions,
  ])

  const pageTableRows = useMemo(
    () =>
      filteredDocuments.map((document) => {
        const row = mapElectronicDocumentToSupportRow(
          document,
          importStatuses[document.id],
        )

        if (
          config.provider === 'JARVIS' &&
          row.action === 'delete' &&
          importStatuses[document.id] === IMPORT_ROW_STATUS.LISTA
        ) {
          return { ...row, action: 'none' as const }
        }

        // Factura de compra SIIGO: si ni la regla exacta del proveedor, ni
        // el historial, ni la IA lograron resolver una cuenta/producto para
        // algún ítem (ni tampoco hay una cuenta de respaldo a nivel de
        // documento), el estado pasa a "Requiere revisión" en vez de
        // "Pendiente" — "Pendiente" sugiere que todo está listo y solo
        // falta un clic, lo cual sería engañoso acá (caso real reportado:
        // proveedor nuevo donde la IA no encontró nada para ningún ítem, y
        // el documento seguía viéndose "Pendiente" como cualquier otro).
        // Vuelve a Pendiente solo(a) al recalcularse sin nada pendiente por
        // resolver (ver needsPurchaseInvoiceReview), típicamente después de
        // que el usuario completa el dato a mano y guarda ("Guardar
        // cambios" actualiza rowItems/rowAccounts, lo que dispara este
        // mismo recálculo).
        if (
          config.key === 'purchaseInvoice' &&
          config.provider === 'SIIGO' &&
          row.importStatus === IMPORT_ROW_STATUS.PENDIENTE
        ) {
          const items =
            rowItems[document.id] ??
            buildPurchaseInvoiceItemDrafts(document, accountOptions, productOptions)

          if (
            needsPurchaseInvoiceReview(
              document.id,
              rowAccounts,
              rowPaymentMethods,
              { [document.id]: items },
              {
                requiresAccount: config.requiresAccount,
                requiresPaymentMethod: config.requiresPaymentMethod,
              },
            )
          ) {
            const importStatus = IMPORT_ROW_STATUS.REQUIERE_REVISION

            return {
              ...row,
              importStatus,
              action: getSupportDocumentActionFromImportStatus(importStatus),
            }
          }
        }

        return row
      }),
    [
      filteredDocuments,
      importStatuses,
      config.provider,
      config.key,
      config.requiresAccount,
      config.requiresPaymentMethod,
      rowItems,
      rowAccounts,
      rowPaymentMethods,
      accountOptions,
      productOptions,
    ],
  )

  // Estados que de verdad muestra alguna fila cargada — con esto se arma el
  // desplegable de Estado. No alcanza con filterOptions.importStatuses del
  // backend: ese trae el estado GUARDADO, y la tabla muestra uno DERIVADO
  // (ver pageTableRows). Un documento guardado como "Lista" que ya existe en
  // SIIGO se muestra como "Existente en SIIGO", así que ofrecer "Lista"
  // llevaba a marcar un filtro que no devolvía ni una fila (bug reportado).
  // Se calcula sobre pageTableRows, o sea antes del recorte por el propio
  // filtro de Estado, para no depender de lo que ese filtro ya descartó.
  const pageStatuses = useMemo(() => {
    const set = new Set<ImportRowStatus>()

    for (const row of pageTableRows) {
      set.add(row.importStatus)
    }

    return set
  }, [pageTableRows])

  // Con un Estado marcado, el backend solo devuelve documentos de ESE estado
  // (ver requestFilters), así que pageStatuses deja de ver el resto y las
  // demás opciones se caerían del desplegable: no se podría pasar de un
  // estado a otro sin limpiar el filtro antes. Por eso se recuerda la última
  // foto tomada sin filtro de Estado y se usa como base mientras haya uno.
  const unfilteredStatusesRef = useRef<ReadonlySet<ImportRowStatus>>(new Set())

  useEffect(() => {
    if (columnFilters.statuses.length === 0) {
      unfilteredStatusesRef.current = pageStatuses
    }
  }, [columnFilters.statuses, pageStatuses])

  // El encabezado de la tabla se fija debajo de la barra de acciones, que
  // también es sticky y cambia de alto según haya o no filas seleccionadas
  // (ver .support-document-page__controls). Se publica su alto como variable
  // CSS en vez de fijar un valor a mano, que quedaría corto justo cuando
  // aparecen las acciones de selección y taparía el encabezado.
  const pageRef = useRef<HTMLElement>(null)
  const controlsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const page = pageRef.current
    const controls = controlsRef.current

    if (!page || !controls) {
      return
    }

    const updateControlsHeight = () => {
      page.style.setProperty(
        '--support-controls-height',
        `${controls.offsetHeight}px`,
      )
    }

    updateControlsHeight()

    const observer = new ResizeObserver(updateControlsHeight)
    observer.observe(controls)

    return () => {
      observer.disconnect()
    }
  }, [])

  const visibleStatuses = useMemo(() => {
    if (columnFilters.statuses.length === 0) {
      return pageStatuses
    }

    return new Set<ImportRowStatus>([
      ...unfilteredStatusesRef.current,
      ...pageStatuses,
    ])
  }, [columnFilters.statuses, pageStatuses])

  const tableRows = useMemo(() => {
    // "Requiere revisión" y "Existente en SIIGO" se piden al backend como su
    // estado real (Pendiente/Lista, ver requestFilters más arriba) — el
    // backend siempre devuelve el superconjunto de ambos (ej. pedir
    // "Pendiente" trae tanto lo que sigue Pendiente como lo que ya se
    // recalculó a "Requiere revisión"). El recorte final a EXACTAMENTE los
    // checkboxes marcados se hace acá, sin importar cuál de los dos (o
    // ninguno) haya seleccionado el usuario — bug real reportado: marcar
    // solo "Pendiente" seguía mostrando filas en "Requiere revisión" porque
    // antes solo se recortaba en el caso contrario (derivado sin su proxy).
    const selectedStatuses = columnFilters.statuses

    const rows =
      selectedStatuses.length > 0
        ? pageTableRows.filter((row) =>
            selectedStatuses.includes(row.importStatus),
          )
        : pageTableRows

    return sortSupportDocumentRows(
      rows,
      sortColumn,
      sortDirection,
      rowDates,
      rowAccounts,
      rowPaymentMethods,
      rowRetentions,
      rowIva,
    )
  }, [
    pageTableRows,
    columnFilters.statuses,
    rowAccounts,
    rowDates,
    rowIva,
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
      setSelectedIva(null)
      setSelectedDueDate('')
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

    setSelectedIva(
      resolveSharedSelectionValue(
        selectedDocumentIds,
        (documentId) => rowIva[documentId] ?? null,
        (left, right) => left.id === right.id,
      ),
    )

    setSelectedDueDate(
      resolveSharedSelectionValue(
        selectedDocumentIds,
        (documentId) => rowDueDates[documentId] ?? null,
        (left, right) => left === right,
      ) ?? '',
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
    onCompleted: (summary) => {
      // Mismo mecanismo que el aviso de import (ver handleImportFile): se
      // guarda la tanda recién enviada, se activa "solo esta tanda" y se
      // deja preseleccionada — así el usuario ve de una cuáles mandó, sin
      // tener que buscarlas entre el resto de la tabla. Reemplaza cualquier
      // vista de import activa (son mutuamente excluyentes).
      setImportNotice(null)
      setShowImportOnly(false)
      setSendNotice({
        documentIds: summary.documentIds,
        successCount: summary.successCount,
        errorCount: summary.errorCount,
      })
      setShowSendOnly(true)
      setSelectedDocumentIds(new Set(summary.documentIds))
      reloadDocuments()
      void refreshSetupStatus()
    },
    onDocumentStatusChange: setImportStatus,
  })

  const queueProgress = sendQueueProgress ?? deleteQueueProgress

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

  const canSuggestAi = selectedDocumentIds.size === 1

  const handleSuggestAccountWithAi = useCallback(async () => {
    if (selectedDocumentIds.size !== 1) {
      return
    }

    const [documentId] = selectedDocumentIds

    setIsSuggestingAi(true)
    setAiSuggestionError(null)
    setAiSuggestionMessage(null)

    try {
      const suggestion = await requestAiPurchaseSuggestion(documentId)

      if (suggestion.accountCode) {
        handleConfigAccountChange({
          code: suggestion.accountCode,
          description: suggestion.accountName ?? suggestion.accountCode,
        })
      }

      const messageParts: string[] = [
        suggestion.accountCode
          ? `Cuenta sugerida aplicada: ${suggestion.accountCode} — ${
              suggestion.accountName ?? ''
            }`.trim()
          : 'La IA no encontró una cuenta contable segura para este documento.',
      ]

      if (suggestion.taxId && suggestion.taxName) {
        messageParts.push(
          `IVA sugerido (revisar y aplicar manualmente si corresponde): ${suggestion.taxName} (${suggestion.taxPercentage}%).`,
        )
      }

      setAiSuggestionMessage(messageParts.join(' '))
    } catch (error) {
      setAiSuggestionError(
        getApiErrorMessage(error, 'No se pudo obtener la sugerencia de IA.'),
      )
    } finally {
      setIsSuggestingAi(false)
    }
  }, [
    selectedDocumentIds,
    handleConfigAccountChange,
    setAiSuggestionError,
    setAiSuggestionMessage,
  ])

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

  const handleConfigIvaChange = useCallback(
    (tax: SiigoTaxOption | null) => {
      setSelectedIva(tax)

      if (selectedDocumentIds.size === 0) {
        return
      }

      setRowIva((current) => {
        const next = { ...current }

        for (const documentId of selectedDocumentIds) {
          next[documentId] = tax
        }

        return next
      })
    },
    [selectedDocumentIds],
  )

  const isCreditSelected = isCreditPaymentMethod(selectedPaymentMethod)

  /** Fecha base para calcular Plazo ↔ Fecha de vencimiento: la fecha compartida
   * de los documentos seleccionados si es uniforme, si no la fecha de hoy. */
  const dueDateReference = useMemo(
    () =>
      resolveSharedSelectionValue(
        selectedDocumentIds,
        (documentId) => rowDates[documentId] ?? null,
        (left, right) => left === right,
      ) ?? getTodayLocalDate(),
    [selectedDocumentIds, rowDates],
  )

  const selectedPlazoDays = useMemo(
    () =>
      selectedDueDate
        ? daysBetweenLocalDates(dueDateReference, selectedDueDate)
        : null,
    [dueDateReference, selectedDueDate],
  )

  const handleConfigPlazoChange = useCallback(
    (days: number | null) => {
      if (days === null) {
        setSelectedDueDate('')
        return
      }

      const nextDueDate = addDaysToLocalDate(dueDateReference, days)
      setSelectedDueDate(nextDueDate)
      applySelectionToCheckedRows(nextDueDate, setRowDueDates)
    },
    [applySelectionToCheckedRows, dueDateReference],
  )

  const handleConfigDueDateChange = useCallback(
    (date: string) => {
      setSelectedDueDate(date)
      applySelectionToCheckedRows(date, setRowDueDates)
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
        rowDueDates,
        effectiveRowItems,
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
      rowDueDates,
      effectiveRowItems,
      config.requiresAccount,
      config.requiresPaymentMethod,
    ],
  )

  const deletableSelectedCount = useMemo(
    () =>
      countDeletableDocuments(
        selectedDocumentIds,
        importStatuses,
        config.provider,
      ),
    [selectedDocumentIds, importStatuses, config.provider],
  )

  const canSendSelected = sendableSelectedCount > 0
  const canDeleteSelected = deletableSelectedCount > 0

  const isRetrySelected = useMemo(() => {
    if (sendableSelectedCount === 0) {
      return false
    }

    let hasSendable = false

    for (const documentId of selectedDocumentIds) {
      const document = documentsById[documentId]

      if (
        !document ||
        !canSendDocument(
          document,
          documentId,
          importStatuses[documentId],
          rowAccounts,
          rowPaymentMethods,
          rowDueDates,
          effectiveRowItems,
          {
            requiresAccount: config.requiresAccount,
            requiresPaymentMethod: config.requiresPaymentMethod,
          },
        )
      ) {
        continue
      }

      hasSendable = true

      if (importStatuses[documentId] !== IMPORT_ROW_STATUS.ERROR) {
        return false
      }
    }

    return hasSendable
  }, [
    sendableSelectedCount,
    selectedDocumentIds,
    documentsById,
    importStatuses,
    rowAccounts,
    rowPaymentMethods,
    rowDueDates,
    effectiveRowItems,
    config.requiresAccount,
    config.requiresPaymentMethod,
  ])

  /** Documentos que aún no quedaron en LISTA (ya enviados/validados) y por lo
   * tanto todavía se pueden configurar (cuenta, medio de pago, etc.) antes de
   * enviarlos — esto incluye ERROR: un documento fallido puede necesitar otra
   * cuenta/medio de pago para reintentar, así que no debe ocultar los campos. */
  const hasConfigurableSelection = useMemo(() => {
    for (const documentId of selectedDocumentIds) {
      const status = importStatuses[documentId]

      if (
        status !== IMPORT_ROW_STATUS.LISTA &&
        status !== IMPORT_ROW_STATUS.EXISTENTE_EN_SIIGO
      ) {
        return true
      }
    }

    return false
  }, [selectedDocumentIds, importStatuses])

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
        rowDueDates,
        effectiveRowItems,
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
      rowDueDates,
      effectiveRowItems,
      config.requiresAccount,
      config.requiresPaymentMethod,
    ],
  )

  const canDeleteRow = useCallback(
    (rowId: string) =>
      isDocumentDeletable(importStatuses[rowId], config.provider),
    [importStatuses, config.provider],
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
      rowIva,
      rowItems: effectiveRowItems,
      rowDates,
      rowDueDates,
      rowObservations,
    })
  }, [
    documentsById,
    importStatuses,
    rowAccounts,
    rowCostCenters,
    rowDates,
    rowDueDates,
    rowIva,
    effectiveRowItems,
    rowObservations,
    rowPaymentMethods,
    rowRetentions,
    selectedDocumentIds,
    sendDocuments,
  ])

  const requestDeleteSelected = useCallback(() => {
    const targets = [...selectedDocumentIds].filter((documentId) =>
      isDocumentDeletable(importStatuses[documentId], config.provider),
    )

    if (targets.length === 0) {
      return
    }

    setPendingDelete({ kind: 'selected', targets })
  }, [config.provider, importStatuses, selectedDocumentIds])

  const runDeleteSelected = useCallback(async (targets: string[]) => {
    setIsDeleting(true)
    setErrorMessage(null)
    setDeleteFeedbackMessage(null)
    setDeleteQueueProgress({
      current: 0,
      total: targets.length,
      completed: 0,
      label: 'Preparando eliminación...',
    })

    let deletedCount = 0
    let failedCount = 0
    let lastError: string | null = null
    let completed = 0
    let started = 0
    const removedIds: string[] = []

    const bumpProgress = (label: string) => {
      setDeleteQueueProgress({
        current: Math.min(Math.max(started, completed), targets.length),
        total: targets.length,
        completed,
        label,
      })
    }

    const deleteOne = async (documentId: string) => {
      started += 1
      setDeletingDocumentId(documentId)
      bumpProgress(`Eliminando… ${completed} de ${targets.length}`)

      try {
        const importStatus = importStatuses[documentId]

        if (isDocumentDeletableFromSiigo(importStatus, config.provider)) {
          await config.deleteSiigoDocument(documentId)
          setImportStatus(documentId, IMPORT_ROW_STATUS.PENDIENTE)
        } else if (isDocumentRemovableFromDatabase(importStatus)) {
          await deleteElectronicDocument(documentId)
          removedIds.push(documentId)
        } else {
          throw new Error('Este registro no se puede eliminar.')
        }

        deletedCount += 1
      } catch (error) {
        failedCount += 1
        lastError = getApiErrorMessage(
          error,
          'No se pudo eliminar el registro seleccionado.',
        )
      }

      completed += 1
      bumpProgress(
        completed === targets.length
          ? `Completado ${completed} de ${targets.length}`
          : `Eliminando… ${completed} de ${targets.length}`,
      )
    }

    const deleteDbOnlyBatch = async (documentIds: string[]) => {
      if (documentIds.length === 0) {
        return
      }

      started += documentIds.length
      bumpProgress(`Eliminando ${documentIds.length} registro(s)…`)

      try {
        const { deletedIds, skippedIds } =
          await deleteElectronicDocumentsBatch(documentIds)

        deletedCount += deletedIds.length
        removedIds.push(...deletedIds)

        if (skippedIds.length > 0) {
          failedCount += skippedIds.length
          lastError = `${skippedIds.length} registro(s) ya no se pudieron eliminar (puede que ya estén en lista o hayan sido borrados desde otra pestaña).`
        }
      } catch (error) {
        failedCount += documentIds.length
        lastError = getApiErrorMessage(
          error,
          'No se pudieron eliminar los registros seleccionados.',
        )
      }

      completed += documentIds.length
      bumpProgress(
        completed === targets.length
          ? `Completado ${completed} de ${targets.length}`
          : `Eliminando… ${completed} de ${targets.length}`,
      )
    }

    try {
      // Borrar solo de la base de datos local es una operación propia (no
      // depende de una API externa), así que van todos en un solo request
      // en lote (antes iban en paralelo pero uno por documento, lo que con
      // 100 registros se notaba lento por el límite de conexiones
      // simultáneas del navegador — ver deleteElectronicDocumentsBatch).
      // Los que hay que eliminar primero en SIIGO sí se escalonan (1s entre
      // cada uno, uno por uno) para no saturar su API — igual que antes.
      const siigoTargetIds = new Set(
        targets.filter((documentId) =>
          isDocumentDeletableFromSiigo(importStatuses[documentId], config.provider),
        ),
      )
      const dbOnlyTargets = targets.filter(
        (documentId) => !siigoTargetIds.has(documentId),
      )
      const siigoTargets = targets.filter((documentId) =>
        siigoTargetIds.has(documentId),
      )

      await Promise.all([
        deleteDbOnlyBatch(dbOnlyTargets),
        Promise.all(
          siigoTargets.map(async (documentId, index) => {
            if (index > 0) {
              await new Promise((resolve) => {
                window.setTimeout(resolve, index * 1000)
              })
            }

            await deleteOne(documentId)
          }),
        ),
      ])

      if (removedIds.length > 0) {
        setSelectedDocumentIds((current) => {
          const next = new Set(current)
          for (const id of removedIds) {
            next.delete(id)
          }
          return next
        })
      }

      if (deletedCount > 0) {
        setDeleteFeedbackMessage(
          failedCount > 0
            ? `${deletedCount} eliminado(s), ${failedCount} con error.`
            : deletedCount === 1
              ? 'Registro eliminado correctamente.'
              : `${deletedCount} registros eliminados correctamente.`,
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
    config.provider,
    config.deleteSiigoDocument,
    importStatuses,
    reloadDocuments,
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
        rowIva,
        rowItems: effectiveRowItems,
        rowDates,
        rowDueDates,
        rowObservations,
      })
    },
    [
      documentsById,
      importStatuses,
      rowAccounts,
      rowCostCenters,
      rowDates,
      rowDueDates,
      rowIva,
      effectiveRowItems,
      rowObservations,
      rowPaymentMethods,
      rowRetentions,
      sendDocuments,
    ],
  )

  const requestDeleteDocument = useCallback(
    (document: ElectronicDocumentListItem) => {
      setPendingDelete({ kind: 'single', document })
    },
    [],
  )

  const runDeleteDocument = useCallback(
    async (document: ElectronicDocumentListItem) => {
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

      const importStatus = importStatuses[document.id]

      try {
        if (isDocumentDeletableFromSiigo(importStatus, config.provider)) {
          await config.deleteSiigoDocument(document.id)
          setImportStatus(document.id, IMPORT_ROW_STATUS.PENDIENTE)
          setDeleteFeedbackMessage('Documento eliminado en SIIGO.')
        } else if (isDocumentRemovableFromDatabase(importStatus)) {
          await deleteElectronicDocument(document.id)
          setSelectedDocumentIds((current) => {
            const next = new Set(current)
            next.delete(document.id)
            return next
          })
          setDeleteFeedbackMessage('Registro eliminado de la base de datos.')
        } else {
          throw new Error('Este registro no se puede eliminar.')
        }

        setDeleteQueueProgress({
          current: 1,
          total: 1,
          completed: 1,
          label: 'Completado 1 de 1',
        })
        reloadDocuments()
      } catch (error) {
        setErrorMessage(
          getApiErrorMessage(
            error,
            'No se pudo eliminar el registro seleccionado.',
          ),
        )
      } finally {
        setIsDeleting(false)
        setDeletingDocumentId(null)
        setDeleteQueueProgress(null)
      }
    },
    [
      config.provider,
      config.deleteSiigoDocument,
      importStatuses,
      reloadDocuments,
      setDeleteFeedbackMessage,
      setErrorMessage,
      setImportStatus,
    ],
  )

  const confirmPendingDelete = useCallback(() => {
    if (!pendingDelete) {
      return
    }

    const request = pendingDelete
    setPendingDelete(null)

    if (request.kind === 'selected') {
      void runDeleteSelected(request.targets)
    } else {
      void runDeleteDocument(request.document)
    }
  }, [pendingDelete, runDeleteDocument, runDeleteSelected])

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
    setStoredElectronicDocumentPageLimit(nextLimit)
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
      setPurchaseInvoiceRetryInfo(null)
      // Se guarda ANTES de importar (no después) para no perderse terceros
      // que la preparación en segundo plano alcance a crear justo en el
      // borde del intervalo — mejor un margen de unos segundos de más que
      // dejar alguno afuera del aviso.
      const importStartedAt = new Date().toISOString()

      try {
        const { documentIds, documentCount, failedRows, jobId, errorCount } =
          await config.importFile(file)

        if (config.key === 'purchaseInvoice' && jobId && errorCount) {
          setPurchaseInvoiceRetryInfo({ jobId, errorCount })
        }

        for (const documentId of documentIds) {
          setImportStatus(documentId, IMPORT_ROW_STATUS.EN_PROCESO)
        }

        if (failedRows && failedRows.length > 0) {
          const preview = failedRows
            .slice(0, 3)
            .map((row) => row.issuerName?.trim() || row.cufe || 'factura')
            .join(', ')
          const suffix =
            failedRows.length > 3 ? `, +${failedRows.length - 3} más` : ''

          setErrorMessage(
            `${failedRows.length} factura(s) no se importaron (no se encontró la factura al consultarla): ${preview}${suffix}.`,
          )
        }

        setSendNotice(null)
        setShowSendOnly(false)
        setImportNotice({ documentCount, documentIds })
        setShowImportOnly(true)
        reloadDocuments({ resetPage: true })
        await watchImportedDocuments(documentIds, () =>
          reloadDocuments({ resetPage: false }),
        )

        // Solo SIIGO crea terceros automáticamente al preparar el import
        // (ver SiigoDocumentPreparationService.tryAutoCreateSupplier) —
        // Jarvis solo busca en su propia tabla de terceros, nunca crea
        // nada. No debe romper el import si falla (ej. sin credenciales
        // SIIGO en este momento puntual): es solo un aviso informativo.
        if (config.provider === 'SIIGO') {
          try {
            const { suppliers } =
              await fetchAutoCreatedSuppliers(importStartedAt)

            if (suppliers.length > 0) {
              const preview = suppliers
                .slice(0, 3)
                .map((supplier) => supplier.supplierName)
                .join(', ')
              const suffix =
                suppliers.length > 3 ? `, +${suppliers.length - 3} más` : ''

              setAutoCreatedSuppliersMessage(
                `Se ${suppliers.length === 1 ? 'creó' : 'crearon'} automáticamente ${suppliers.length} tercero${suppliers.length === 1 ? '' : 's'} en SIIGO: ${preview}${suffix}.`,
              )
            }
          } catch {
            // Aviso informativo — si falla, el import ya se completó igual.
          }
        }
      } catch (error) {
        setErrorMessage(getApiErrorMessage(error, config.importFileError))
      } finally {
        setIsImporting(false)
      }
    })()
  }

  /** Confirma los cambios hechos en el editor de detalle de Factura de
   * compra (ítems, forma de pago, plazo, retenciones, observaciones) al
   * estado por fila — igual que hoy funcionan cuenta/medio de pago/
   * retenciones: solo queda en pantalla, listo para "Enviar". */
  const handleSaveRowEdits = useCallback(
    (documentId: string, edits: PurchaseInvoiceDetailEditorSave) => {
      setRowItems((current) => ({ ...current, [documentId]: edits.items }))
      setRowPaymentMethods((current) => ({
        ...current,
        [documentId]: edits.paymentMethod,
      }))
      setRowDueDates((current) => ({ ...current, [documentId]: edits.dueDate }))
      setRowObservations((current) => ({
        ...current,
        [documentId]: edits.observations,
      }))
      setRowRetentions((current) => ({ ...current, [documentId]: edits.retentions }))
      setRowDocumentDiscounts((current) => ({
        ...current,
        [documentId]: edits.documentDiscount,
      }))
    },
    [],
  )

  const handleCreateJarvisTercero = useCallback(
    (document: ElectronicDocumentListItem) => {
      setTerceroModalDocument(document)
    },
    [],
  )

  const handleTerceroCreated = useCallback(() => {
    setTerceroModalDocument(null)
    reloadDocuments({ resetPage: false })
  }, [reloadDocuments])

  return (
    <main className="support-document-page" ref={pageRef}>
      <PageHeader
        title={config.pageTitle}
        description={config.pageDescription}
        actions={
          <>
            {config.showTemplateDownload && config.downloadTemplate && (
              <Button
                variant="secondary"
                onClick={handleDownloadTemplate}
                disabled={isDownloadingTemplate || isImporting}
              >
                {isDownloadingTemplate
                  ? config.downloadingTemplateLabel
                  : config.templateButtonLabel}
              </Button>
            )}

            <Button variant="primary" onClick={openFilePicker} disabled={isImporting}>
              <span className="support-document-page__import-icon" aria-hidden="true">
                +
              </span>
              {isImporting ? config.importingButtonLabel : config.importButtonLabel}
            </Button>
          </>
        }
      />

      <input
        ref={fileInputRef}
        type="file"
        accept={config.fileInputAccept}
        hidden
        onChange={handleFileChange}
      />

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

      {sendNotice && (
        <SendSuccessBanner
          notice={sendNotice}
          showSendOnly={showSendOnly}
          onShowSendOnly={() => setShowSendOnly(true)}
          onShowAll={() => setShowSendOnly(false)}
          onDismiss={() => {
            setSendNotice(null)
            setShowSendOnly(false)
          }}
        />
      )}

      {isResuming ? (
        <ImportLoadingOverlay
          key="resuming"
          title={buildResumingStageTitle(config.provider)}
          tips={RESUMING_STAGE_TIPS[config.provider]}
        />
      ) : isImporting && config.key === 'purchaseInvoice' ? (
        <PurchaseInvoiceImportProgress
          key="importing-purchase-invoice"
          jobId={latestPurchaseInvoiceImportJob?.jobId ?? null}
        />
      ) : isImporting ? (
        <ImportLoadingOverlay
          key="importing"
          title="Importando Excel"
          tips={IMPORT_STAGE_TIPS}
        />
      ) : isSending && sendQueueProgress ? (
        <ImportLoadingOverlay
          key="sending"
          title={buildSendingStageTitle(config.provider)}
          tips={[sendQueueProgress.label]}
        />
      ) : null}

      <div className="support-document-page__alerts">
        {deleteQueueProgress && (
          <BatchQueueProgressBanner
            progress={deleteQueueProgress}
            tone="delete"
          />
        )}
        {feedbackMessage && !sendNotice && (
          <p className="support-document-page__feedback" role="status">
            {feedbackMessage}
          </p>
        )}
        {deleteFeedbackMessage && (
          <p className="support-document-page__feedback" role="status">
            {deleteFeedbackMessage}
          </p>
        )}
        {autoCreatedSuppliersMessage && (
          <p className="support-document-page__feedback" role="status">
            {autoCreatedSuppliersMessage}
          </p>
        )}

        {purchaseInvoiceRetryInfo && (
          <p className="support-document-page__feedback" role="status">
            {purchaseInvoiceRetryInfo.errorCount} factura(s) fallaron en la
            importación.{' '}
            <button
              type="button"
              className="support-document-page__link-button"
              disabled={isRetryingFailedImportRows}
              onClick={() => {
                void (async () => {
                  const jobId = purchaseInvoiceRetryInfo.jobId
                  setIsRetryingFailedImportRows(true)
                  try {
                    await retryFailedPurchaseInvoiceImportRows(jobId)
                    setPurchaseInvoiceRetryInfo(null)
                    setIsImporting(true)
                    const finalJob = await waitForTerminalStatus(jobId)
                    if (finalJob.errorCount > 0) {
                      setPurchaseInvoiceRetryInfo({
                        jobId,
                        errorCount: finalJob.errorCount,
                      })
                    }
                    reloadDocuments({ resetPage: false })
                  } catch (error) {
                    setErrorMessage(
                      getApiErrorMessage(
                        error,
                        'No se pudieron reintentar las filas fallidas.',
                      ),
                    )
                  } finally {
                    setIsRetryingFailedImportRows(false)
                    setIsImporting(false)
                  }
                })()
              }}
            >
              {isRetryingFailedImportRows
                ? 'Reintentando...'
                : 'Reintentar fallidas'}
            </button>
          </p>
        )}

        {errorMessage && <ErrorMessage message={errorMessage} />}
        {resumeErrorMessage && <ErrorMessage message={resumeErrorMessage} />}
        {sendErrorMessage && <ErrorMessage message={sendErrorMessage} />}
        {accountsError && <ErrorMessage message={accountsError} />}
        {paymentMethodsError && <ErrorMessage message={paymentMethodsError} />}
        {costCentersError && <ErrorMessage message={costCentersError} />}
        {retentionsError && <ErrorMessage message={retentionsError} />}
        {aiSuggestionMessage && (
          <p className="support-document-page__feedback" role="status">
            {aiSuggestionMessage}
          </p>
        )}
        {aiSuggestionError && <ErrorMessage message={aiSuggestionError} />}
      </div>

      <SupportDocumentFilterBar
        filterOptions={filterOptions}
        columnFilters={columnFilters}
        selectedSupplierNits={selectedSupplierNits}
        dateRangeFilter={config.key === 'purchaseInvoice'}
        visibleStatuses={visibleStatuses}
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

      <div
        ref={controlsAnchorRef}
        className="support-document-page__controls-anchor"
        aria-hidden="true"
      />

      <div
        ref={controlsRef}
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
          showIvaField={config.showIvaField}
          actionsOnly={config.key === 'purchaseInvoice'}
          ivaOptions={ivaOptions}
          selectedIva={selectedIva}
          onIvaChange={handleConfigIvaChange}
          selectedAccount={selectedAccount}
          selectedPaymentMethod={selectedPaymentMethod}
          selectedCostCenter={selectedCostCenter}
          isCreditSelected={isCreditSelected}
          selectedPlazoDays={selectedPlazoDays}
          selectedDueDate={selectedDueDate}
          showAccountField={config.requiresAccount}
          canSend={canSendSelected}
          canDelete={canDeleteSelected}
          hasConfigurableSelection={hasConfigurableSelection}
          isRetry={isRetrySelected}
          canSuggestAi={canSuggestAi}
          isSuggestingAi={isSuggestingAi}
          onSuggestAi={handleSuggestAccountWithAi}
          isSending={isSending}
          isDeleting={isDeleting}
          progressLabel={queueProgress?.label ?? null}
          disabled={isLoading || isImporting || isResuming || isModalOpen}
          onAccountChange={handleConfigAccountChange}
          onPaymentMethodChange={handleConfigPaymentMethodChange}
          onCostCenterChange={handleConfigCostCenterChange}
          onRetentionTypeChange={handleRetentionTypeChange}
          onPlazoChange={handleConfigPlazoChange}
          onDueDateChange={handleConfigDueDateChange}
          onSend={handleSendSelected}
          onDelete={requestDeleteSelected}
          onClearSelection={() => setSelectedDocumentIds(new Set())}
        />
      </div>

      <SupportDocumentTable
        rows={tableRows}
        selectedIds={selectedDocumentIds}
        rowDates={rowDates}
        rowAccounts={rowAccounts}
        accountOptions={tableAccountOptions}
        rowPaymentMethods={rowPaymentMethods}
        rowRetentions={rowRetentions}
        rowIva={rowIva}
        rowDocumentDiscounts={rowDocumentDiscounts}
        showIvaColumn={config.showIvaField || config.key === 'purchaseInvoice'}
        showSummaryColumns={config.key === 'purchaseInvoice'}
        rowDueDates={rowDueDates}
        rowObservations={rowObservations}
        rowItems={rowItems}
        paymentMethodOptions={paymentMethodOptions}
        productOptions={productOptions}
        ivaOptions={ivaOptions}
        retentionCatalogTypes={config.retentionCatalogTypes}
        retentionOptionsByType={retentionOptionsByType}
        onSaveRowEdits={handleSaveRowEdits}
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
        canDeleteRow={canDeleteRow}
        documentsById={documentsById}
        sendProcessingLabel={
          queueProgress?.label ?? config.sendProcessingLabel
        }
        supplierMissingLabel={config.supplierMissingLabel}
        onToggleRow={handleToggleRow}
        onSelectRows={handleSelectRows}
        onSendDocument={handleSendDocument}
        onDeleteDocument={requestDeleteDocument}
        onCreateSupplier={handleCreateJarvisTercero}
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

      <CreateJarvisTerceroModal
        isOpen={terceroModalDocument != null}
        onClose={() => setTerceroModalDocument(null)}
        initialDocumentType={terceroModalDocument?.supplierDocumentType}
        initialDocumentNumber={terceroModalDocument?.supplierNit}
        resumeDocumentId={terceroModalDocument?.id}
        provider={config.provider === 'JARVIS' ? 'JARVIS' : 'SIIGO'}
        onCreated={handleTerceroCreated}
      />

      <ConfirmDialog
        isOpen={pendingDelete !== null}
        title={`Eliminar ${config.pageTitle}`}
        message={(() => {
          const targets =
            pendingDelete?.kind === 'selected'
              ? pendingDelete.targets
              : pendingDelete?.kind === 'single'
                ? [pendingDelete.document.id]
                : []
          const removesFromDatabase = targets.some((id) =>
            isDocumentRemovableFromDatabase(importStatuses[id]),
          )
          const deletesFromSiigo = targets.some((id) =>
            isDocumentDeletableFromSiigo(importStatuses[id], config.provider),
          )

          if (removesFromDatabase && !deletesFromSiigo) {
            return targets.length > 1
              ? `¿Eliminar ${targets.length} registros de la base de datos? Esta acción no se puede deshacer.`
              : '¿Eliminar este registro de la base de datos? Esta acción no se puede deshacer.'
          }

          if (deletesFromSiigo && !removesFromDatabase) {
            return targets.length > 1
              ? `¿Eliminar ${targets.length} registros en SIIGO? Podrás volver a enviarlos después.`
              : '¿Eliminar este registro en SIIGO? Podrás volver a enviarlo después.'
          }

          return targets.length > 1
            ? `¿Eliminar ${targets.length} registros seleccionados?`
            : '¿Eliminar el registro seleccionado?'
        })()}
        confirmLabel="Eliminar"
        variant="danger"
        isBusy={isDeleting}
        onConfirm={confirmPendingDelete}
        onCancel={() => setPendingDelete(null)}
      />

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
