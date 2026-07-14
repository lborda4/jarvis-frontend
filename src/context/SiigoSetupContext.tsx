import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { fetchSiigoCredentialsConfigured } from '../services/siigoService'
import {
  getAuthEntryMode,
  isSiigoConfiguredLocally,
  markSiigoConfigured as persistSiigoConfigured,
} from '../utils/siigoSetupStorage'
import { useAuth } from './AuthContext'

interface SiigoSetupContextValue {
  isCheckingSiigoSetup: boolean
  isSiigoConfigured: boolean
  isSupportDocumentEnabled: boolean
  requiresSiigoSetup: boolean
  markSiigoConfigured: () => void
  refreshSiigoSetupStatus: () => Promise<void>
}

const SiigoSetupContext = createContext<SiigoSetupContextValue | null>(null)

export function SiigoSetupProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const [isCheckingSiigoSetup, setIsCheckingSiigoSetup] = useState(true)
  const [isSiigoConfigured, setIsSiigoConfigured] = useState(false)

  const refreshSiigoSetupStatus = useCallback(async () => {
    if (!isAuthenticated) {
      setIsSiigoConfigured(false)
      setIsCheckingSiigoSetup(false)
      return
    }

    if (getAuthEntryMode() !== 'register') {
      setIsSiigoConfigured(true)
      setIsCheckingSiigoSetup(false)
      return
    }

    if (isSiigoConfiguredLocally()) {
      setIsSiigoConfigured(true)
      setIsCheckingSiigoSetup(false)
      return
    }

    setIsCheckingSiigoSetup(true)

    try {
      const configured = await fetchSiigoCredentialsConfigured()

      if (configured) {
        persistSiigoConfigured()
      }

      setIsSiigoConfigured(configured)
    } catch {
      setIsSiigoConfigured(false)
    } finally {
      setIsCheckingSiigoSetup(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    void refreshSiigoSetupStatus()
  }, [refreshSiigoSetupStatus])

  const markSiigoConfigured = useCallback(() => {
    persistSiigoConfigured()
    setIsSiigoConfigured(true)
  }, [])

  const entryMode = getAuthEntryMode()
  const isSupportDocumentEnabled =
    entryMode !== 'register' || isSiigoConfigured
  const requiresSiigoSetup = entryMode === 'register' && !isSiigoConfigured

  const value = useMemo<SiigoSetupContextValue>(
    () => ({
      isCheckingSiigoSetup,
      isSiigoConfigured,
      isSupportDocumentEnabled,
      requiresSiigoSetup,
      markSiigoConfigured,
      refreshSiigoSetupStatus,
    }),
    [
      isCheckingSiigoSetup,
      isSiigoConfigured,
      isSupportDocumentEnabled,
      markSiigoConfigured,
      refreshSiigoSetupStatus,
      requiresSiigoSetup,
    ],
  )

  return (
    <SiigoSetupContext.Provider value={value}>{children}</SiigoSetupContext.Provider>
  )
}

export function useSiigoSetup(): SiigoSetupContextValue {
  const context = useContext(SiigoSetupContext)

  if (!context) {
    throw new Error('useSiigoSetup debe usarse dentro de SiigoSetupProvider.')
  }

  return context
}
