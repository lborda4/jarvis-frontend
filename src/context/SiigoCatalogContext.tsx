import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { SiigoAccountOption } from '../constants/siigoAccountCatalog'
import type { SiigoCostCenterOption } from '../constants/siigoCostCenterCatalog'
import type { SiigoPaymentMethodOption } from '../constants/siigoPaymentMethodCatalog'
import {
  PURCHASE_INVOICE_PAYMENT_DOCUMENT_TYPE,
  PURCHASE_INVOICE_RETENTION_CATALOG_TYPES,
  SUPPORT_DOCUMENT_PAYMENT_DOCUMENT_TYPE,
  SUPPORT_DOCUMENT_RETENTION_CATALOG_TYPES,
  type SiigoTaxOption,
} from '../constants/siigoTaxCatalog'
import type { DocumentWorkspaceConfig } from '../constants/documentWorkspaceConfig'
import { getApiErrorMessage } from '../services/apiClient'
import {
  fetchSiigoAccounts,
  fetchSiigoCostCenters,
  fetchSiigoPaymentMethods,
  fetchSiigoTaxes,
  syncSiigoCatalogs,
} from '../services/siigoService'
import { mapCatalogToAccountOptions } from '../utils/siigoAccounts'
import { mapCatalogToCostCenterOptions } from '../utils/siigoCostCenters'
import { mapCatalogToPaymentMethodOptions } from '../utils/siigoPaymentMethods'
import {
  mapCatalogToTaxOptions,
  mergeRetentionTaxOptions,
} from '../utils/siigoTaxes'
import { useIntegrationSetup } from './IntegrationSetupContext'
import { useAuth } from './AuthContext'

const PAYMENT_DOCUMENT_TYPES = [
  SUPPORT_DOCUMENT_PAYMENT_DOCUMENT_TYPE,
  PURCHASE_INVOICE_PAYMENT_DOCUMENT_TYPE,
] as const

const ALL_RETENTION_TAX_TYPES = [
  ...new Set([
    ...SUPPORT_DOCUMENT_RETENTION_CATALOG_TYPES,
    ...PURCHASE_INVOICE_RETENTION_CATALOG_TYPES,
  ]),
]

interface SiigoCatalogContextValue {
  isLoadingCatalogs: boolean
  accountOptions: SiigoAccountOption[]
  paymentMethodOptionsByDocumentType: Record<string, SiigoPaymentMethodOption[]>
  retentionOptionsByTaxType: Record<string, SiigoTaxOption[]>
  costCenterOptions: SiigoCostCenterOption[]
  accountsError: string | null
  paymentMethodsError: string | null
  costCentersError: string | null
  retentionsError: string | null
  refreshCatalogs: () => Promise<void>
}

const SiigoCatalogContext = createContext<SiigoCatalogContextValue | null>(null)

async function loadCatalogsFromApi(): Promise<{
  accountOptions: SiigoAccountOption[]
  paymentMethodOptionsByDocumentType: Record<string, SiigoPaymentMethodOption[]>
  retentionOptionsByTaxType: Record<string, SiigoTaxOption[]>
  costCenterOptions: SiigoCostCenterOption[]
  accountsError: string | null
  paymentMethodsError: string | null
  costCentersError: string | null
  retentionsError: string | null
}> {
  let accountOptions: SiigoAccountOption[] = []
  let accountsError: string | null = null

  try {
    accountOptions = mapCatalogToAccountOptions(await fetchSiigoAccounts())
  } catch (error) {
    accountsError = getApiErrorMessage(
      error,
      'No se pudo cargar el catálogo de cuentas contables.',
    )
  }

  const paymentMethodOptionsByDocumentType: Record<
    string,
    SiigoPaymentMethodOption[]
  > = {}
  const paymentMethodErrors: string[] = []

  await Promise.all(
    PAYMENT_DOCUMENT_TYPES.map(async (documentType) => {
      try {
        paymentMethodOptionsByDocumentType[documentType] =
          mapCatalogToPaymentMethodOptions(
            await fetchSiigoPaymentMethods(documentType),
          )
      } catch (error) {
        paymentMethodErrors.push(
          getApiErrorMessage(
            error,
            `No se pudo cargar el catálogo de medios de pago (${documentType}).`,
          ),
        )
      }
    }),
  )

  const retentionOptionsByTaxType: Record<string, SiigoTaxOption[]> = {}
  const retentionErrors: string[] = []

  await Promise.all(
    ALL_RETENTION_TAX_TYPES.map(async (taxType) => {
      try {
        retentionOptionsByTaxType[taxType] = mapCatalogToTaxOptions(
          await fetchSiigoTaxes(taxType),
        )
      } catch (error) {
        retentionErrors.push(
          getApiErrorMessage(
            error,
            `No se pudo cargar el catálogo de ${taxType}.`,
          ),
        )
      }
    }),
  )

  let costCenterOptions: SiigoCostCenterOption[] = []
  let costCentersError: string | null = null

  try {
    costCenterOptions = mapCatalogToCostCenterOptions(await fetchSiigoCostCenters())
  } catch (error) {
    costCentersError = getApiErrorMessage(
      error,
      'No se pudo cargar el catálogo de centros de costo.',
    )
  }

  return {
    accountOptions,
    paymentMethodOptionsByDocumentType,
    retentionOptionsByTaxType,
    costCenterOptions,
    accountsError,
    paymentMethodsError:
      paymentMethodErrors.length === PAYMENT_DOCUMENT_TYPES.length
        ? 'No se pudieron cargar los catálogos de medios de pago.'
        : paymentMethodErrors[0] ?? null,
    costCentersError,
    retentionsError:
      retentionErrors.length === ALL_RETENTION_TAX_TYPES.length
        ? 'No se pudieron cargar los catálogos de retenciones.'
        : retentionErrors[0] ?? null,
  }
}

export function SiigoCatalogProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const { isSiigoConfigured } = useIntegrationSetup()
  const [isLoadingCatalogs, setIsLoadingCatalogs] = useState(false)
  const [accountOptions, setAccountOptions] = useState<SiigoAccountOption[]>([])
  const [paymentMethodOptionsByDocumentType, setPaymentMethodOptionsByDocumentType] =
    useState<Record<string, SiigoPaymentMethodOption[]>>({})
  const [retentionOptionsByTaxType, setRetentionOptionsByTaxType] = useState<
    Record<string, SiigoTaxOption[]>
  >({})
  const [costCenterOptions, setCostCenterOptions] = useState<
    SiigoCostCenterOption[]
  >([])
  const [accountsError, setAccountsError] = useState<string | null>(null)
  const [paymentMethodsError, setPaymentMethodsError] = useState<string | null>(
    null,
  )
  const [costCentersError, setCostCentersError] = useState<string | null>(null)
  const [retentionsError, setRetentionsError] = useState<string | null>(null)

  const applyCatalogState = useCallback(
    (catalogs: Awaited<ReturnType<typeof loadCatalogsFromApi>>) => {
      setAccountOptions(catalogs.accountOptions)
      setPaymentMethodOptionsByDocumentType(
        catalogs.paymentMethodOptionsByDocumentType,
      )
      setRetentionOptionsByTaxType(catalogs.retentionOptionsByTaxType)
      setCostCenterOptions(catalogs.costCenterOptions)
      setAccountsError(catalogs.accountsError)
      setPaymentMethodsError(catalogs.paymentMethodsError)
      setCostCentersError(catalogs.costCentersError)
      setRetentionsError(catalogs.retentionsError)
    },
    [],
  )

  const refreshCatalogs = useCallback(async () => {
    if (!isAuthenticated || !isSiigoConfigured) {
      applyCatalogState({
        accountOptions: [],
        paymentMethodOptionsByDocumentType: {},
        retentionOptionsByTaxType: {},
        costCenterOptions: [],
        accountsError: null,
        paymentMethodsError: null,
        costCentersError: null,
        retentionsError: null,
      })
      return
    }

    setIsLoadingCatalogs(true)

    try {
      const catalogs = await loadCatalogsFromApi()
      applyCatalogState(catalogs)
    } finally {
      setIsLoadingCatalogs(false)
    }

    void syncSiigoCatalogs()
      .then(async () => {
        applyCatalogState(await loadCatalogsFromApi())
      })
      .catch(() => {})
  }, [applyCatalogState, isAuthenticated, isSiigoConfigured])

  useEffect(() => {
    void refreshCatalogs()
  }, [refreshCatalogs])

  const value = useMemo<SiigoCatalogContextValue>(
    () => ({
      isLoadingCatalogs,
      accountOptions,
      paymentMethodOptionsByDocumentType,
      retentionOptionsByTaxType,
      costCenterOptions,
      accountsError,
      paymentMethodsError,
      costCentersError,
      retentionsError,
      refreshCatalogs,
    }),
    [
      isLoadingCatalogs,
      accountOptions,
      paymentMethodOptionsByDocumentType,
      retentionOptionsByTaxType,
      costCenterOptions,
      accountsError,
      paymentMethodsError,
      costCentersError,
      retentionsError,
      refreshCatalogs,
    ],
  )

  return (
    <SiigoCatalogContext.Provider value={value}>
      {children}
    </SiigoCatalogContext.Provider>
  )
}

export function useSiigoCatalog(): SiigoCatalogContextValue {
  const context = useContext(SiigoCatalogContext)

  if (!context) {
    throw new Error(
      'useSiigoCatalog debe usarse dentro de SiigoCatalogProvider.',
    )
  }

  return context
}

export function useSiigoWorkspaceCatalog(config: DocumentWorkspaceConfig) {
  const catalog = useSiigoCatalog()

  const paymentMethodOptions = useMemo(
    () =>
      catalog.paymentMethodOptionsByDocumentType[config.paymentDocumentType] ??
      [],
    [catalog.paymentMethodOptionsByDocumentType, config.paymentDocumentType],
  )

  const retentionOptionsByType = useMemo(() => {
    const optionsByType: Record<string, SiigoTaxOption[]> = {}

    for (const taxType of config.retentionCatalogTypes) {
      optionsByType[taxType] = catalog.retentionOptionsByTaxType[taxType] ?? []
    }

    return optionsByType
  }, [catalog.retentionOptionsByTaxType, config.retentionCatalogTypes])

  const retentionCatalogOptions = useMemo(
    () =>
      mergeRetentionTaxOptions(
        ...config.retentionCatalogTypes.map(
          (taxType) => retentionOptionsByType[taxType] ?? [],
        ),
      ),
    [config.retentionCatalogTypes, retentionOptionsByType],
  )

  return {
    isLoadingCatalogs: catalog.isLoadingCatalogs,
    accountOptions: catalog.accountOptions,
    paymentMethodOptions,
    retentionCatalogOptions,
    retentionOptionsByType,
    costCenterOptions: catalog.costCenterOptions,
    accountsError: catalog.accountsError,
    paymentMethodsError: catalog.paymentMethodsError,
    costCentersError: catalog.costCentersError,
    retentionsError: catalog.retentionsError,
    refreshCatalogs: catalog.refreshCatalogs,
  }
}
