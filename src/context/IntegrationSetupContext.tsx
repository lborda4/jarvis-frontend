import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { fetchIntegrationProviders } from '../services/integrationService'
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
  documentLimit: number | null
  documentsUsed: number
  documentsRemaining: number | null
  hasSupportDocumentAccess: boolean
  hasPurchaseInvoiceAccess: boolean
  isSupportDocumentResolutionConfigured: boolean
  isElectronicInvoiceResolutionConfigured: boolean
  isSupportDocumentEnabled: boolean
  isPurchaseInvoiceEnabled: boolean
  requiresSetup: boolean
  setupPath: string
  markConfigured: () => void
  refreshSetupStatus: () => Promise<void>
}

const IntegrationSetupContext =
  createContext<IntegrationSetupContextValue | null>(null)

const SIIGO_SETUP_PATH = '/configuracion/integracion-siigo'
const JARVIS_SETUP_PATH = '/configuracion/integracion-jarvis'

function isJarvisSetupComplete({
  companyConfigured,
  documentTypes,
  supportResolutionConfigured,
  invoiceResolutionConfigured,
}: {
  companyConfigured: boolean
  documentTypes: string[]
  supportResolutionConfigured: boolean
  invoiceResolutionConfigured: boolean
}): boolean {
  if (!companyConfigured) {
    return false
  }

  const needsSupport = documentTypes.includes('SUPPORT_DOCUMENT')
  const needsInvoice = documentTypes.includes('PURCHASE_INVOICE')

  if (needsSupport && !supportResolutionConfigured) {
    return false
  }

  if (needsInvoice && !invoiceResolutionConfigured) {
    return false
  }

  return true
}

export function IntegrationSetupProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, user, isLoading: isAuthLoading } = useAuth()
  const companyId = user?.company?.id
  const [isCheckingSetup, setIsCheckingSetup] = useState(true)
  const [integrationProviders, setIntegrationProviders] = useState<
    IntegrationProvider[]
  >([])
  const [integrationMode, setIntegrationMode] =
    useState<IntegrationMode>('unknown')
  const [isSiigoConfigured, setIsSiigoConfigured] = useState(false)
  const [hasSiigoAccounts, setHasSiigoAccounts] = useState(false)
  const [hasSiigoDocumentTypesConfigured, setHasSiigoDocumentTypesConfigured] =
    useState(false)
  const [isJarvisCompanyConfigured, setIsJarvisCompanyConfigured] =
    useState(false)
  const [
    isSupportDocumentResolutionConfigured,
    setIsSupportDocumentResolutionConfigured,
  ] = useState(false)
  const [
    isElectronicInvoiceResolutionConfigured,
    setIsElectronicInvoiceResolutionConfigured,
  ] = useState(false)
  const [includedDocumentTypes, setIncludedDocumentTypes] = useState<string[]>(
    [],
  )
  const [isSubscriptionActive, setIsSubscriptionActive] = useState(false)
  const [documentLimit, setDocumentLimit] = useState<number | null>(null)
  const [documentsUsed, setDocumentsUsed] = useState(0)
  const [documentsRemaining, setDocumentsRemaining] = useState<number | null>(
    null,
  )

  const resetJarvisFlags = useCallback(() => {
    setIsJarvisCompanyConfigured(false)
    setIsSupportDocumentResolutionConfigured(false)
    setIsElectronicInvoiceResolutionConfigured(false)
  }, [])

  const refreshSetupStatus = useCallback(async () => {
    // Evita un frame en falso "no configurado" durante el restore de sesión.
    if (isAuthLoading) {
      setIsCheckingSetup(true)
      return
    }

    if (!isAuthenticated || !companyId) {
      setIntegrationProviders([])
      setIntegrationMode('unknown')
      setIsSiigoConfigured(false)
      setHasSiigoAccounts(false)
      setHasSiigoDocumentTypesConfigured(false)
      resetJarvisFlags()
      setIncludedDocumentTypes([])
      setIsSubscriptionActive(false)
      setDocumentLimit(null)
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

    setIsCheckingSetup(!hasFreshSetupCache)

    try {
      const { providers } = await fetchIntegrationProviders()
      const mode = resolveIntegrationMode(providers)

      setIntegrationProviders(providers)
      setIntegrationMode(mode)

      if (mode === 'siigo') {
        const status = await fetchSiigoCredentialsStatus()
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
        const companyConfigured = Boolean(status.configured)
        const subscription = status.subscription
        const subscriptionActive = subscription?.status === 'ACTIVE'
        const documentTypes = subscription?.includedDocumentTypes ?? []
        const supportResolutionConfigured = Boolean(
          status.supportDocumentResolutionConfigured,
        )
        const invoiceResolutionConfigured = Boolean(
          status.electronicInvoiceResolutionConfigured,
        )
        const fullyConfigured = isJarvisSetupComplete({
          companyConfigured,
          documentTypes,
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

      setIsSiigoConfigured(false)
      setHasSiigoAccounts(false)
      setHasSiigoDocumentTypesConfigured(false)
      resetJarvisFlags()
      setIncludedDocumentTypes([])
      setIsSubscriptionActive(false)
      setDocumentLimit(null)
      setDocumentsUsed(0)
      setDocumentsRemaining(null)
      clearIntegrationConfigured()
    } catch {
      setIntegrationProviders([])
      setIntegrationMode('unknown')
      setIsSiigoConfigured(false)
      setHasSiigoAccounts(false)
      setHasSiigoDocumentTypesConfigured(false)
      resetJarvisFlags()
      setIncludedDocumentTypes([])
      setIsSubscriptionActive(false)
      setDocumentLimit(null)
      setDocumentsUsed(0)
      setDocumentsRemaining(null)
      clearIntegrationConfigured()
    } finally {
      setIsCheckingSetup(false)
    }
  }, [companyId, isAuthLoading, isAuthenticated, resetJarvisFlags])

  useEffect(() => {
    void refreshSetupStatus()
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
    documentTypes: includedDocumentTypes,
    supportResolutionConfigured: isSupportDocumentResolutionConfigured,
    invoiceResolutionConfigured: isElectronicInvoiceResolutionConfigured,
  })
  const isConfigured = isJarvisCompany
    ? isJarvisFullyConfigured
    : isSiigoFullyConfigured
  const setupPath = isJarvisCompany ? JARVIS_SETUP_PATH : SIIGO_SETUP_PATH
  const isSetupStatusPending = isAuthLoading || isCheckingSetup
  const requiresSetup =
    !isSetupStatusPending &&
    integrationMode !== 'unknown' &&
    !isConfigured
  const hasSupportDocumentAccess = includedDocumentTypes.includes(
    'SUPPORT_DOCUMENT',
  )
  const hasPurchaseInvoiceAccess = includedDocumentTypes.includes(
    'PURCHASE_INVOICE',
  )
  const isSupportDocumentEnabled =
    isConfigured &&
    isSubscriptionActive &&
    hasSupportDocumentAccess &&
    (isSiigoCompany || isJarvisCompany)
  const isPurchaseInvoiceEnabled =
    isConfigured &&
    isSubscriptionActive &&
    hasPurchaseInvoiceAccess &&
    (isSiigoCompany || isJarvisCompany)

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
      documentLimit,
      documentsUsed,
      documentsRemaining,
      hasSupportDocumentAccess,
      hasPurchaseInvoiceAccess,
      isSupportDocumentResolutionConfigured,
      isElectronicInvoiceResolutionConfigured,
      isSupportDocumentEnabled,
      isPurchaseInvoiceEnabled,
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
      documentLimit,
      documentsUsed,
      documentsRemaining,
      hasSupportDocumentAccess,
      hasPurchaseInvoiceAccess,
      isSupportDocumentResolutionConfigured,
      isElectronicInvoiceResolutionConfigured,
      isSupportDocumentEnabled,
      isPurchaseInvoiceEnabled,
      requiresSetup,
      setupPath,
      markConfigured,
      refreshSetupStatus,
    ],
  )

  return (
    <IntegrationSetupContext.Provider value={value}>
      {children}
    </IntegrationSetupContext.Provider>
  )
}

export function useIntegrationSetup(): IntegrationSetupContextValue {
  const context = useContext(IntegrationSetupContext)

  if (!context) {
    throw new Error(
      'useIntegrationSetup debe usarse dentro de IntegrationSetupProvider.',
    )
  }

  return context
}

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
