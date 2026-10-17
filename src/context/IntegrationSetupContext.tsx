import type { SiigoDocumentQuotas } from '../types/siigo'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { fetchIntegrationProviders } from '../services/integrationService'
import { readIntegrationSetupSnapshot, saveIntegrationSetupSnapshot, removeIntegrationSetupSnapshot } from '../utils/integrationSetupSnapshot'
import { fetchJarvisCredentialsStatus } from '../services/jarvisService'
import { fetchSiigoCredentialsStatus } from '../services/siigoService'
import {
  resolveIntegrationMode,
  type IntegrationMode,
  type IntegrationProvider,
} from '../types/integration'
import {
  clearIntegrationConfigured,
  markIntegrationConfigured as persistIntegrationConfigured,
} from '../utils/integrationSetupStorage'
import { useAuth } from './AuthContext'
import {
  companyQueryKey,
  getActiveCompanyId,
  isCachedQueryFresh,
  QUERY_STALE_MS,
} from '../services/queryCache'

interface IntegrationSetupContextValue {
  isCheckingSetup: boolean
  integrationMode: IntegrationMode
  integrationProviders: IntegrationProvider[]
  isConfigured: boolean
  isSiigoCompany: boolean
  isJarvisCompany: boolean
  isSiigoConfigured: boolean
  hasSiigoAccounts: boolean
  hasSiigoDocumentTypesConfigured: boolean
  /** Credenciales/datos de empresa Jarvis guardados (paso 1). */
  isJarvisCompanyConfigured: boolean
  /**
   * @deprecated Prefer isJarvisCompanyConfigured for el paso empresa,
   * o isConfigured para setup completo.
   */
  isJarvisConfigured: boolean
  includedDocumentTypes: string[]
  isSubscriptionActive: boolean
  documentQuotas: SiigoDocumentQuotas
  documentLimit: number | null
  documentsUsed: number
  documentsRemaining: number | null
  hasSupportDocumentAccess: boolean
  hasPurchaseInvoiceAccess: boolean
  isSupportDocumentResolutionConfigured: boolean
  isElectronicInvoiceResolutionConfigured: boolean
  isSupportDocumentEnabled: boolean
  isPurchaseInvoiceEnabled: boolean
  isSalesInvoiceEnabled: boolean
  isCreditNoteEnabled: boolean
  requiresSetup: boolean
  setupPath: string
  markConfigured: () => void
  refreshSetupStatus: (options?: { background?: boolean }) => Promise<void>
}

const IntegrationSetupContext =
  createContext<IntegrationSetupContextValue | null>(null)

// eslint-disable-next-line react-refresh/only-export-components
export function useIsJarvisIntegration(): boolean {
  return useContext(IntegrationSetupContext)?.isJarvisCompany ?? false
}

const SIIGO_SETUP_PATH = '/configuracion/integracion-siigo'
const JARVIS_SETUP_PATH = '/configuracion/integracion-jarvis'

function isJarvisSetupComplete({
  companyConfigured,
  supportResolutionConfigured,
  invoiceResolutionConfigured,
}: {
  companyConfigured: boolean
  supportResolutionConfigured: boolean
  invoiceResolutionConfigured: boolean
}): boolean {
  return companyConfigured && (supportResolutionConfigured || invoiceResolutionConfigured)
}

export function IntegrationSetupProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, user, isLoading: isAuthLoading } = useAuth()
  const companyId = user?.company?.id
  const [initialSnapshot] = useState(() => readIntegrationSetupSnapshot<IntegrationSetupContextValue>(user?.id, companyId))
  const [isCheckingSetup, setIsCheckingSetup] = useState(!initialSnapshot)
  const [resolvedCompanyId, setResolvedCompanyId] = useState<string | null>(initialSnapshot ? companyId ?? null : null)
  const resolvedCompanyRef = useRef<string | null>(initialSnapshot ? companyId ?? null : null)
  const confirmedSetupRef = useRef(Boolean(initialSnapshot))
  const [integrationProviders, setIntegrationProviders] = useState<
    IntegrationProvider[]
  >(initialSnapshot?.integrationProviders ?? [])
  const [integrationMode, setIntegrationMode] =
    useState<IntegrationMode>(initialSnapshot?.integrationMode ?? 'unknown')
  const [isSiigoConfigured, setIsSiigoConfigured] = useState(initialSnapshot?.isSiigoConfigured ?? false)
  const [hasSiigoAccounts, setHasSiigoAccounts] = useState(initialSnapshot?.hasSiigoAccounts ?? false)
  const [hasSiigoDocumentTypesConfigured, setHasSiigoDocumentTypesConfigured] =
    useState(initialSnapshot?.hasSiigoDocumentTypesConfigured ?? false)
  const [isJarvisCompanyConfigured, setIsJarvisCompanyConfigured] =
    useState(initialSnapshot?.isJarvisCompanyConfigured ?? false)
  const [
    isSupportDocumentResolutionConfigured,
    setIsSupportDocumentResolutionConfigured,
  ] = useState(initialSnapshot?.isSupportDocumentResolutionConfigured ?? false)
  const [
    isElectronicInvoiceResolutionConfigured,
    setIsElectronicInvoiceResolutionConfigured,
  ] = useState(initialSnapshot?.isElectronicInvoiceResolutionConfigured ?? false)
  const [includedDocumentTypes, setIncludedDocumentTypes] = useState<string[]>(
    initialSnapshot?.includedDocumentTypes ?? [],
  )
  const [isSubscriptionActive, setIsSubscriptionActive] = useState(initialSnapshot?.isSubscriptionActive ?? false)
  const [documentQuotas, setDocumentQuotas] = useState<SiigoDocumentQuotas>(initialSnapshot?.documentQuotas ?? {})
  const [documentLimit, setDocumentLimit] = useState<number | null>(initialSnapshot?.documentLimit ?? null)
  const [documentsUsed, setDocumentsUsed] = useState(initialSnapshot?.documentsUsed ?? 0)
  const [documentsRemaining, setDocumentsRemaining] = useState<number | null>(
    initialSnapshot?.documentsRemaining ?? null,
  )

  const resetJarvisFlags = useCallback(() => {
    setIsJarvisCompanyConfigured(false)
    setIsSupportDocumentResolutionConfigured(false)
    setIsElectronicInvoiceResolutionConfigured(false)
  }, [])

  const refreshSetupStatus = useCallback(async (options?: { background?: boolean }) => {
    // Evita un frame en falso "no configurado" durante el restore de sesión.
    if (isAuthLoading) {
      setIsCheckingSetup(true)
      return
    }

    if (!isAuthenticated || !companyId) {
      resolvedCompanyRef.current = null
      confirmedSetupRef.current = false
      setResolvedCompanyId(null)
      setIntegrationProviders([])
      setIntegrationMode('unknown')
      setIsSiigoConfigured(false)
      setHasSiigoAccounts(false)
      setHasSiigoDocumentTypesConfigured(false)
      resetJarvisFlags()
      setIncludedDocumentTypes([])
      setIsSubscriptionActive(false)
      setDocumentLimit(null)
      setDocumentQuotas({})
      setDocumentsUsed(0)
      setDocumentsRemaining(null)
      clearIntegrationConfigured()
      setIsCheckingSetup(false)
      return
    }

    // Si ya hay datos frescos en caché, no bloquear la UI.
    const hasFreshSetupCache =
      isCachedQueryFresh(
        companyQueryKey(['integrations', 'providers']),
        QUERY_STALE_MS.providers,
      ) &&
      (isCachedQueryFresh(
        companyQueryKey(['jarvis', 'credentials-status']),
        QUERY_STALE_MS.credentials,
      ) ||
        isCachedQueryFresh(
          companyQueryKey(['siigo', 'credentials-status']),
          QUERY_STALE_MS.credentials,
        ))

    const isBackgroundRefresh = resolvedCompanyRef.current === companyId && (Boolean(options?.background) || confirmedSetupRef.current)
    setIsCheckingSetup(!hasFreshSetupCache && !isBackgroundRefresh)

    try {
      const { providers } = await fetchIntegrationProviders(companyId)
      if (getActiveCompanyId() !== companyId) return
      const mode = resolveIntegrationMode(providers)

      if (mode === 'siigo') {
        const status = await fetchSiigoCredentialsStatus()
        if (getActiveCompanyId() !== companyId) return
        confirmedSetupRef.current = true
        setIntegrationProviders(providers)
        setIntegrationMode(mode)
        const configured = Boolean(status.configured)
        const accountsReady = Boolean(status.hasAccounts)
        const documentTypesReady = Boolean(status.documentTypesConfigured)
        const subscription = status.subscription
        const subscriptionActive = subscription?.status === 'ACTIVE'
        const documentTypes = subscription?.includedDocumentTypes ?? []

        setIsSiigoConfigured(configured)
        setHasSiigoAccounts(accountsReady)
        setHasSiigoDocumentTypesConfigured(documentTypesReady)
        resetJarvisFlags()
        setIncludedDocumentTypes(documentTypes)
        setIsSubscriptionActive(subscriptionActive)
        setDocumentQuotas(subscription?.documentQuotas ?? {})
        setDocumentLimit(subscription?.documentLimit ?? null)
        setDocumentsUsed(subscription?.documentsUsed ?? 0)
        setDocumentsRemaining(subscription?.remaining ?? null)

        if (configured && accountsReady && documentTypesReady) {
          persistIntegrationConfigured()
        } else {
          clearIntegrationConfigured()
        }

        return
      }

      if (mode === 'jarvis') {
        const status = await fetchJarvisCredentialsStatus()
        if (getActiveCompanyId() !== companyId) return
        confirmedSetupRef.current = true
        setIntegrationProviders(providers)
        setIntegrationMode(mode)
        const companyConfigured = Boolean(status.configured)
        const subscription = status.subscription
        const subscriptionActive = subscription?.status === 'ACTIVE'
        const documentTypes = ['SUPPORT_DOCUMENT', 'PURCHASE_INVOICE']
        const supportResolutionConfigured = Boolean(
          status.supportDocumentResolutionConfigured,
        )
        const invoiceResolutionConfigured = Boolean(
          status.electronicInvoiceResolutionConfigured,
        )
        const fullyConfigured = isJarvisSetupComplete({
          companyConfigured,
          supportResolutionConfigured,
          invoiceResolutionConfigured,
        })

        setIsJarvisCompanyConfigured(companyConfigured)
        setIsSupportDocumentResolutionConfigured(supportResolutionConfigured)
        setIsElectronicInvoiceResolutionConfigured(invoiceResolutionConfigured)
        setIsSiigoConfigured(false)
        setHasSiigoAccounts(false)
        setHasSiigoDocumentTypesConfigured(false)
        setIncludedDocumentTypes(documentTypes)
        setIsSubscriptionActive(subscriptionActive)
        setDocumentLimit(subscription?.documentLimit ?? null)
        setDocumentsUsed(subscription?.documentsUsed ?? 0)
        setDocumentsRemaining(subscription?.remaining ?? null)

        if (fullyConfigured) {
          persistIntegrationConfigured()
        } else {
          clearIntegrationConfigured()
        }

        return
      }

      confirmedSetupRef.current = false
      setIntegrationProviders(providers)
      setIntegrationMode(mode)
      setIsSiigoConfigured(false)
      setHasSiigoAccounts(false)
      setHasSiigoDocumentTypesConfigured(false)
      resetJarvisFlags()
      setIncludedDocumentTypes([])
      setIsSubscriptionActive(false)
      setDocumentLimit(null)
      setDocumentQuotas({})
      setDocumentsUsed(0)
      setDocumentsRemaining(null)
      clearIntegrationConfigured()
    } catch {
      if (getActiveCompanyId() !== companyId) return
      // A failed background refresh must not discard the confirmed setup or
      // unmount a form immediately after it has saved successfully.
      if (isBackgroundRefresh) return
      confirmedSetupRef.current = false
      setIntegrationProviders([])
      setIntegrationMode('unknown')
      setIsSiigoConfigured(false)
      setHasSiigoAccounts(false)
      setHasSiigoDocumentTypesConfigured(false)
      resetJarvisFlags()
      setIncludedDocumentTypes([])
      setIsSubscriptionActive(false)
      setDocumentLimit(null)
      setDocumentQuotas({})
      setDocumentsUsed(0)
      setDocumentsRemaining(null)
      clearIntegrationConfigured()
    } finally {
      if (getActiveCompanyId() === companyId) {
        resolvedCompanyRef.current = companyId
        setResolvedCompanyId(companyId)
        setIsCheckingSetup(false)
      }
    }
  }, [companyId, user?.id, isAuthLoading, isAuthenticated, resetJarvisFlags])

  useEffect(() => {
    let active = true
    void Promise.resolve().then(() => { if (active) return refreshSetupStatus() })
    return () => { active = false }
  }, [refreshSetupStatus])

  const markConfigured = useCallback(() => {
    // Solo marca el paso de empresa; el setup completo se confirma con refresh.
    if (integrationMode === 'jarvis') {
      setIsJarvisCompanyConfigured(true)
      setIsSiigoConfigured(false)
      setHasSiigoAccounts(false)
      return
    }

    setIsSiigoConfigured(true)
    setIsJarvisCompanyConfigured(false)
  }, [integrationMode])

  const isSiigoCompany = integrationMode === 'siigo'
  const isJarvisCompany = integrationMode === 'jarvis'
  const isSiigoFullyConfigured =
    isSiigoConfigured && hasSiigoAccounts && hasSiigoDocumentTypesConfigured
  const isJarvisFullyConfigured = isJarvisSetupComplete({
    companyConfigured: isJarvisCompanyConfigured,
    supportResolutionConfigured: isSupportDocumentResolutionConfigured,
    invoiceResolutionConfigured: isElectronicInvoiceResolutionConfigured,
  })
  const isConfigured = isJarvisCompany
    ? isJarvisFullyConfigured
    : isSiigoFullyConfigured
  const setupPath = isJarvisCompany ? JARVIS_SETUP_PATH : SIIGO_SETUP_PATH
  const isSetupStatusPending = isAuthLoading || isCheckingSetup || (Boolean(companyId) && resolvedCompanyId !== companyId)
  const requiresSetup =
    !isSetupStatusPending &&
    integrationMode !== 'unknown' &&
    !isConfigured
  const hasSupportDocumentAccess = isJarvisCompany || includedDocumentTypes.includes(
    'SUPPORT_DOCUMENT',
  )
  const hasPurchaseInvoiceAccess = isJarvisCompany || includedDocumentTypes.includes(
    'PURCHASE_INVOICE',
  )
  // En Jarvis cada tipo de documento se emite contra SU resolución DIAN, así
  // que sin ella la sección no puede hacer nada: se habilita solo cuando la
  // resolución de ese tipo ya quedó asociada. En SIIGO no aplica — ahí la
  // numeración la pone el comprobante de cargue, no una resolución propia.
  const isSupportDocumentEnabled =
    (isJarvisCompany ? isJarvisCompanyConfigured : isSiigoFullyConfigured) &&
    (isJarvisCompany || isSubscriptionActive) &&
    hasSupportDocumentAccess &&
    (isSiigoCompany ||
      (isJarvisCompany && isSupportDocumentResolutionConfigured))
  const isPurchaseInvoiceEnabled =
    isConfigured &&
    isSubscriptionActive &&
    hasPurchaseInvoiceAccess &&
    isSiigoCompany
  /** Factura de venta es exclusiva de Jarvis y se emite con la resolución de
   * factura electrónica. */
  const isSalesInvoiceEnabled =
    isJarvisCompany &&
    isJarvisCompanyConfigured &&
    isElectronicInvoiceResolutionConfigured
  /** Las notas crédito de venta son exclusivas de la integración Jarvis. */
  const isCreditNoteEnabled = isSalesInvoiceEnabled

  const value = useMemo<IntegrationSetupContextValue>(
    () => ({
      isCheckingSetup: isSetupStatusPending,
      integrationMode,
      integrationProviders,
      isConfigured,
      isSiigoCompany,
      isJarvisCompany,
      isSiigoConfigured,
      hasSiigoAccounts,
      hasSiigoDocumentTypesConfigured,
      isJarvisCompanyConfigured,
      isJarvisConfigured: isJarvisCompanyConfigured,
      includedDocumentTypes,
      isSubscriptionActive,
      documentQuotas,
      documentLimit,
      documentsUsed,
      documentsRemaining,
      hasSupportDocumentAccess,
      hasPurchaseInvoiceAccess,
      isSupportDocumentResolutionConfigured,
      isElectronicInvoiceResolutionConfigured,
      isSupportDocumentEnabled,
      isPurchaseInvoiceEnabled,
      isSalesInvoiceEnabled,
      isCreditNoteEnabled,
      requiresSetup,
      setupPath,
      markConfigured,
      refreshSetupStatus,
    }),
    [
      isSetupStatusPending,
      integrationMode,
      integrationProviders,
      isConfigured,
      isSiigoCompany,
      isJarvisCompany,
      isSiigoConfigured,
      hasSiigoAccounts,
      hasSiigoDocumentTypesConfigured,
      isJarvisCompanyConfigured,
      includedDocumentTypes,
      isSubscriptionActive,
      documentQuotas,
      documentLimit,
      documentsUsed,
      documentsRemaining,
      hasSupportDocumentAccess,
      hasPurchaseInvoiceAccess,
      isSupportDocumentResolutionConfigured,
      isElectronicInvoiceResolutionConfigured,
      isSupportDocumentEnabled,
      isPurchaseInvoiceEnabled,
      isSalesInvoiceEnabled,
      isCreditNoteEnabled,
      requiresSetup,
      setupPath,
      markConfigured,
      refreshSetupStatus,
    ],
  )

  useEffect(() => {
    if (!user?.id || !companyId || isSetupStatusPending) return
    if (value.isJarvisCompany) saveIntegrationSetupSnapshot(user.id, companyId, value)
    else removeIntegrationSetupSnapshot(user.id, companyId)
  }, [user?.id, companyId, isSetupStatusPending, value])

  return (
    <IntegrationSetupContext.Provider value={value}>
      {children}
    </IntegrationSetupContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- The context hooks share their provider module.
export function useIntegrationSetup(): IntegrationSetupContextValue {
  const context = useContext(IntegrationSetupContext)

  if (!context) {
    throw new Error(
      'useIntegrationSetup debe usarse dentro de IntegrationSetupProvider.',
    )
  }

  return context
}

// eslint-disable-next-line react-refresh/only-export-components -- Compatibility hook for the same provider.
export function useSiigoSetup(): Pick<
  IntegrationSetupContextValue,
  | 'isCheckingSetup'
  | 'isSiigoConfigured'
  | 'hasSiigoAccounts'
  | 'isSupportDocumentEnabled'
  | 'requiresSetup'
  | 'refreshSetupStatus'
> & {
  isCheckingSiigoSetup: boolean
  requiresSiigoSetup: boolean
  markSiigoConfigured: () => void
  refreshSiigoSetupStatus: () => Promise<void>
} {
  const context = useIntegrationSetup()

  return {
    isCheckingSetup: context.isCheckingSetup,
    isCheckingSiigoSetup: context.isCheckingSetup,
    isSiigoConfigured: context.isSiigoConfigured,
    hasSiigoAccounts: context.hasSiigoAccounts,
    isSupportDocumentEnabled: context.isSupportDocumentEnabled,
    requiresSiigoSetup: context.isSiigoCompany && context.requiresSetup,
    requiresSetup: context.isSiigoCompany && context.requiresSetup,
    markSiigoConfigured: context.markConfigured,
    refreshSiigoSetupStatus: context.refreshSetupStatus,
    refreshSetupStatus: context.refreshSetupStatus,
  }
}
