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
import { fetchJarvisCredentialsConfigured } from '../services/jarvisService'
import { fetchSiigoCredentialsConfigured } from '../services/siigoService'
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

interface IntegrationSetupContextValue {
  isCheckingSetup: boolean
  integrationMode: IntegrationMode
  integrationProviders: IntegrationProvider[]
  isConfigured: boolean
  isSiigoCompany: boolean
  isJarvisCompany: boolean
  isSiigoConfigured: boolean
  isJarvisConfigured: boolean
  isSupportDocumentEnabled: boolean
  requiresSetup: boolean
  setupPath: string
  markConfigured: () => void
  refreshSetupStatus: () => Promise<void>
}

const IntegrationSetupContext =
  createContext<IntegrationSetupContextValue | null>(null)

const SIIGO_SETUP_PATH = '/configuracion/integracion-siigo'
const JARVIS_SETUP_PATH = '/configuracion/integracion-jarvis'

export function IntegrationSetupProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuth()
  const companyId = user?.company?.id
  const [isCheckingSetup, setIsCheckingSetup] = useState(true)
  const [integrationProviders, setIntegrationProviders] = useState<
    IntegrationProvider[]
  >([])
  const [integrationMode, setIntegrationMode] =
    useState<IntegrationMode>('unknown')
  const [isSiigoConfigured, setIsSiigoConfigured] = useState(false)
  const [isJarvisConfigured, setIsJarvisConfigured] = useState(false)

  const refreshSetupStatus = useCallback(async () => {
    if (!isAuthenticated || !companyId) {
      setIntegrationProviders([])
      setIntegrationMode('unknown')
      setIsSiigoConfigured(false)
      setIsJarvisConfigured(false)
      clearIntegrationConfigured()
      setIsCheckingSetup(false)
      return
    }

    setIsCheckingSetup(true)

    try {
      const { providers } = await fetchIntegrationProviders()
      const mode = resolveIntegrationMode(providers)

      setIntegrationProviders(providers)
      setIntegrationMode(mode)

      if (mode === 'siigo') {
        const configured = await fetchSiigoCredentialsConfigured()
        setIsSiigoConfigured(configured)
        setIsJarvisConfigured(false)

        if (configured) {
          persistIntegrationConfigured()
        } else {
          clearIntegrationConfigured()
        }

        return
      }

      if (mode === 'jarvis') {
        const configured = await fetchJarvisCredentialsConfigured()
        setIsJarvisConfigured(configured)
        setIsSiigoConfigured(false)

        if (configured) {
          persistIntegrationConfigured()
        } else {
          clearIntegrationConfigured()
        }

        return
      }

      setIsSiigoConfigured(false)
      setIsJarvisConfigured(false)
      clearIntegrationConfigured()
    } catch {
      setIntegrationProviders([])
      setIntegrationMode('unknown')
      setIsSiigoConfigured(false)
      setIsJarvisConfigured(false)
      clearIntegrationConfigured()
    } finally {
      setIsCheckingSetup(false)
    }
  }, [companyId, isAuthenticated])

  useEffect(() => {
    void refreshSetupStatus()
  }, [refreshSetupStatus])

  const markConfigured = useCallback(() => {
    persistIntegrationConfigured()

    if (integrationMode === 'jarvis') {
      setIsJarvisConfigured(true)
      setIsSiigoConfigured(false)
      return
    }

    setIsSiigoConfigured(true)
    setIsJarvisConfigured(false)
  }, [integrationMode])

  const isSiigoCompany = integrationMode === 'siigo'
  const isJarvisCompany = integrationMode === 'jarvis'
  const isConfigured = isJarvisCompany ? isJarvisConfigured : isSiigoConfigured
  const setupPath = isJarvisCompany ? JARVIS_SETUP_PATH : SIIGO_SETUP_PATH
  const requiresSetup = integrationMode !== 'unknown' && !isConfigured
  const isSupportDocumentEnabled = isSiigoCompany && isSiigoConfigured

  const value = useMemo<IntegrationSetupContextValue>(
    () => ({
      isCheckingSetup,
      integrationMode,
      integrationProviders,
      isConfigured,
      isSiigoCompany,
      isJarvisCompany,
      isSiigoConfigured,
      isJarvisConfigured,
      isSupportDocumentEnabled,
      requiresSetup,
      setupPath,
      markConfigured,
      refreshSetupStatus,
    }),
    [
      isCheckingSetup,
      integrationMode,
      integrationProviders,
      isConfigured,
      isSiigoCompany,
      isJarvisCompany,
      isSiigoConfigured,
      isJarvisConfigured,
      isSupportDocumentEnabled,
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
    isSupportDocumentEnabled: context.isSupportDocumentEnabled,
    requiresSiigoSetup: context.isSiigoCompany && context.requiresSetup,
    requiresSetup: context.isSiigoCompany && context.requiresSetup,
    markSiigoConfigured: context.markConfigured,
    refreshSiigoSetupStatus: context.refreshSetupStatus,
    refreshSetupStatus: context.refreshSetupStatus,
  }
}
