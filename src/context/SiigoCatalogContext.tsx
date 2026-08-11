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
import {
  cachedQuery,
  companyQueryKey,
  peekCachedQuery,
  QUERY_STALE_MS,
  setCachedQuery,
} from '../services/queryCache'
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

type SiigoCatalogBundle = {
  accountOptions: SiigoAccountOption[]
  paymentMethodOptionsByDocumentType: Record<string, SiigoPaymentMethodOption[]>
  retentionOptionsByTaxType: Record<string, SiigoTaxOption[]>
  costCenterOptions: SiigoCostCenterOption[]
  accountsError: string | null
  paymentMethodsError: string | null
  costCentersError: string | null
  retentionsError: string | null
}

const EMPTY_CATALOGS: SiigoCatalogBundle = {
  accountOptions: [],
  paymentMethodOptionsByDocumentType: {},
  retentionOptionsByTaxType: {},
  costCenterOptions: [],
  accountsError: null,
  paymentMethodsError: null,
  costCentersError: null,
  retentionsError: null,
}

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

function siigoCatalogCacheKey(): string {
  return companyQueryKey(['siigo', 'catalog-bundle'])
}

async function loadCatalogsFromApi(): Promise<SiigoCatalogBundle> {
  const [
    accountsResult,
    paymentResults,
    retentionResults,
    costCentersResult,
  ] = await Promise.all([
    fetchSiigoAccounts()
      .then((items) => ({
        accountOptions: mapCatalogToAccountOptions(items),
        accountsError: null as string | null,
      }))
      .catch((error) => ({
        accountOptions: [] as SiigoAccountOption[],
        accountsError: getApiErrorMessage(
          error,
          'No se pudo cargar el catálogo de cuentas contables.',
        ),
      })),
    Promise.all(
      PAYMENT_DOCUMENT_TYPES.map(async (documentType) => {
        try {
          return {
            documentType,
            options: mapCatalogToPaymentMethodOptions(
              await fetchSiigoPaymentMethods(documentType),
            ),
            error: null as string | null,
          }
        } catch (error) {
          return {
            documentType,
            options: [] as SiigoPaymentMethodOption[],
            error: getApiErrorMessage(
              error,
              `No se pudo cargar el catálogo de medios de pago (${documentType}).`,
            ),
          }
        }
      }),
    ),
    Promise.all(
      ALL_RETENTION_TAX_TYPES.map(async (taxType) => {
        try {
          return {
            taxType,
            options: mapCatalogToTaxOptions(await fetchSiigoTaxes(taxType)),
            error: null as string | null,
          }
        } catch (error) {
          return {
            taxType,
            options: [] as SiigoTaxOption[],
            error: getApiErrorMessage(
              error,
              `No se pudo cargar el catálogo de ${taxType}.`,
            ),
          }
        }
      }),
    ),
    fetchSiigoCostCenters()
      .then((items) => ({
        costCenterOptions: mapCatalogToCostCenterOptions(items),
        costCentersError: null as string | null,
      }))
      .catch((error) => ({
        costCenterOptions: [] as SiigoCostCenterOption[],
        costCentersError: getApiErrorMessage(
          error,
          'No se pudo cargar el catálogo de centros de costo.',
        ),
      })),
  ])

  const paymentMethodOptionsByDocumentType: Record<
    string,
    SiigoPaymentMethodOption[]
  > = {}
  const paymentMethodErrors: string[] = []

  for (const item of paymentResults) {
    paymentMethodOptionsByDocumentType[item.documentType] = item.options
    if (item.error) {
      paymentMethodErrors.push(item.error)
    }
  }

  const retentionOptionsByTaxType: Record<string, SiigoTaxOption[]> = {}
  const retentionErrors: string[] = []

  for (const item of retentionResults) {
    retentionOptionsByTaxType[item.taxType] = item.options
    if (item.error) {
      retentionErrors.push(item.error)
    }
  }

  return {
    accountOptions: accountsResult.accountOptions,
    paymentMethodOptionsByDocumentType,
    retentionOptionsByTaxType,
    costCenterOptions: costCentersResult.costCenterOptions,
    accountsError: accountsResult.accountsError,
    paymentMethodsError:
      paymentMethodErrors.length === PAYMENT_DOCUMENT_TYPES.length
        ? 'No se pudieron cargar los catálogos de medios de pago.'
        : paymentMethodErrors[0] ?? null,
    costCentersError: costCentersResult.costCentersError,
    retentionsError:
      retentionErrors.length === ALL_RETENTION_TAX_TYPES.length
        ? 'No se pudieron cargar los catálogos de retenciones.'
        : retentionErrors[0] ?? null,
  }
}

async function loadCatalogsCached(force = false): Promise<SiigoCatalogBundle> {
  return cachedQuery(
    siigoCatalogCacheKey(),
    QUERY_STALE_MS.siigoCatalogBundle,
    loadCatalogsFromApi,
    { force },
  )
}

export function SiigoCatalogProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuth()
  const { isSiigoConfigured } = useIntegrationSetup()
  const companyId = user?.company?.id
  const cachedBundle = peekCachedQuery<SiigoCatalogBundle>(siigoCatalogCacheKey())
  const [isLoadingCatalogs, setIsLoadingCatalogs] = useState(
    () => !cachedBundle,
  )
  const [accountOptions, setAccountOptions] = useState<SiigoAccountOption[]>(
    () => cachedBundle?.accountOptions ?? [],
  )
  const [paymentMethodOptionsByDocumentType, setPaymentMethodOptionsByDocumentType] =
    useState<Record<string, SiigoPaymentMethodOption[]>>(
      () => cachedBundle?.paymentMethodOptionsByDocumentType ?? {},
    )
  const [retentionOptionsByTaxType, setRetentionOptionsByTaxType] = useState<
    Record<string, SiigoTaxOption[]>
  >(() => cachedBundle?.retentionOptionsByTaxType ?? {})
  const [costCenterOptions, setCostCenterOptions] = useState<
    SiigoCostCenterOption[]
  >(() => cachedBundle?.costCenterOptions ?? [])
  const [accountsError, setAccountsError] = useState<string | null>(
    () => cachedBundle?.accountsError ?? null,
  )
  const [paymentMethodsError, setPaymentMethodsError] = useState<string | null>(
    () => cachedBundle?.paymentMethodsError ?? null,
  )
  const [costCentersError, setCostCentersError] = useState<string | null>(
    () => cachedBundle?.costCentersError ?? null,
  )
  const [retentionsError, setRetentionsError] = useState<string | null>(
    () => cachedBundle?.retentionsError ?? null,
  )

  const applyCatalogState = useCallback((catalogs: SiigoCatalogBundle) => {
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
  }, [])

  const refreshCatalogs = useCallback(async () => {
    if (!isAuthenticated || !isSiigoConfigured) {
      applyCatalogState(EMPTY_CATALOGS)
      setIsLoadingCatalogs(false)
      return
    }

    const peeked = peekCachedQuery<SiigoCatalogBundle>(siigoCatalogCacheKey())
    if (peeked) {
      applyCatalogState(peeked)
      setIsLoadingCatalogs(false)
    } else {
      setIsLoadingCatalogs(true)
    }

    try {
      const catalogs = await loadCatalogsCached()
      applyCatalogState(catalogs)
    } finally {
      setIsLoadingCatalogs(false)
    }

    // Sync en background; solo reescribe UI si hay datos nuevos (sin spinner).
    void syncSiigoCatalogs()
      .then(async () => {
        const catalogs = await loadCatalogsCached(true)
        setCachedQuery(siigoCatalogCacheKey(), catalogs)
        applyCatalogState(catalogs)
      })
      .catch(() => undefined)
  }, [applyCatalogState, isAuthenticated, isSiigoConfigured])

  useEffect(() => {
    void refreshCatalogs()
  }, [refreshCatalogs, companyId])

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
  const [jarvisPaymentMethods, setJarvisPaymentMethods] = useState<
    SiigoPaymentMethodOption[]
  >([])
  const [jarvisRetentionsByType, setJarvisRetentionsByType] = useState<
    Record<string, SiigoTaxOption[]>
  >({})
  const [jarvisCatalogError, setJarvisCatalogError] = useState<string | null>(
    null,
  )
  const [isLoadingJarvisCatalogs, setIsLoadingJarvisCatalogs] = useState(false)

  useEffect(() => {
    if (config.provider !== 'JARVIS') {
      return
    }

    let cancelled = false

    void (async () => {
      const { fetchJarvisCatalogs } = await import('../services/jarvisService')
      const { companyQueryKey, peekCachedQuery } = await import(
        '../services/queryCache'
      )
      type JarvisCatalogsPeek = Awaited<ReturnType<typeof fetchJarvisCatalogs>>
      const peeked = peekCachedQuery<JarvisCatalogsPeek>(
        companyQueryKey(['jarvis', 'catalogs']),
      )

      const applyCatalogs = (response: JarvisCatalogsPeek) => {
        setJarvisPaymentMethods(
          response.paymentMethods.map((item) => ({
            id: item.id,
            name: item.name,
            type: item.type ?? 'NextPyme',
          })),
        )

        const byType: Record<string, SiigoTaxOption[]> = {}
        for (const taxType of config.retentionCatalogTypes) {
          byType[taxType] = response.taxes
            .filter((tax) =>
              tax.name.toLowerCase().includes(taxType.toLowerCase()),
            )
            .map((tax) => ({
              id: tax.id,
              name: tax.name,
              type: taxType,
              percentage: tax.percentage ?? 0,
              active: true,
            }))
        }

        setJarvisRetentionsByType(byType)
      }

      if (peeked && !cancelled) {
        applyCatalogs(peeked)
        setIsLoadingJarvisCatalogs(false)
      } else if (!cancelled) {
        setIsLoadingJarvisCatalogs(true)
      }

      setJarvisCatalogError(null)

      try {
        const response = await fetchJarvisCatalogs()

        if (cancelled) {
          return
        }

        applyCatalogs(response)
      } catch (error) {
        if (!cancelled) {
          setJarvisCatalogError(
            getApiErrorMessage(
              error,
              'No se pudieron cargar los catálogos de Jarvis.',
            ),
          )
        }
      } finally {
        if (!cancelled) {
          setIsLoadingJarvisCatalogs(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [config.provider, config.retentionCatalogTypes])

  const paymentMethodOptions = useMemo(() => {
    if (config.provider === 'JARVIS') {
      return jarvisPaymentMethods
    }

    return (
      catalog.paymentMethodOptionsByDocumentType[config.paymentDocumentType] ??
      []
    )
  }, [
    catalog.paymentMethodOptionsByDocumentType,
    config.paymentDocumentType,
    config.provider,
    jarvisPaymentMethods,
  ])

  const retentionOptionsByType = useMemo(() => {
    if (config.provider === 'JARVIS') {
      return jarvisRetentionsByType
    }

    const optionsByType: Record<string, SiigoTaxOption[]> = {}

    for (const taxType of config.retentionCatalogTypes) {
      optionsByType[taxType] = catalog.retentionOptionsByTaxType[taxType] ?? []
    }

    return optionsByType
  }, [
    catalog.retentionOptionsByTaxType,
    config.provider,
    config.retentionCatalogTypes,
    jarvisRetentionsByType,
  ])

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
    isLoadingCatalogs:
      config.provider === 'JARVIS'
        ? isLoadingJarvisCatalogs
        : catalog.isLoadingCatalogs,
    accountOptions: config.provider === 'JARVIS' ? [] : catalog.accountOptions,
    paymentMethodOptions,
    retentionCatalogOptions,
    retentionOptionsByType,
    costCenterOptions:
      config.provider === 'JARVIS' ? [] : catalog.costCenterOptions,
    accountsError: config.provider === 'JARVIS' ? null : catalog.accountsError,
    paymentMethodsError:
      config.provider === 'JARVIS'
        ? jarvisCatalogError
        : catalog.paymentMethodsError,
    costCentersError:
      config.provider === 'JARVIS' ? null : catalog.costCentersError,
    retentionsError:
      config.provider === 'JARVIS'
        ? jarvisCatalogError
        : catalog.retentionsError,
    refreshCatalogs: catalog.refreshCatalogs,
  }
}
