import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { AuthCompany, AuthUser, LoginRequest, RegisterRequest } from '../types/auth'
import { getApiErrorMessage } from '../services/apiClient'
import {
  fetchCurrentUser,
  login as loginRequest,
  logout as logoutRequest,
  register as registerRequest,
  switchCompany as switchCompanyRequest,
} from '../services/authService'
import {
  AUTH_SESSION_EXPIRED_EVENT,
  getStoredSessionSnapshot,
  hasStoredSession,
  setStoredSessionSnapshot,
} from '../services/authStorage'
import { wakeBackend } from '../services/healthService'
import {
  invalidateQueryCache,
  setActiveCompanyId,
} from '../services/queryCache'

interface AuthContextValue {
  user: AuthUser | null
  companies: AuthCompany[]
  isAuthenticated: boolean
  isLoading: boolean
  isSwitchingCompany: boolean
  login: (payload: LoginRequest) => Promise<AuthUser>
  register: (payload: RegisterRequest) => Promise<void>
  switchCompany: (companyId: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  // Snapshot de la última sesión confirmada (ver authStorage) — permite
  // pintar la app de una sola vez cuando el navegador descarta/recarga la
  // pestaña por inactividad, en vez de bloquear con "Validando sesión..."
  // esperando el roundtrip a fetchCurrentUser. Se revalida en segundo plano
  // en el efecto de abajo, sin bloquear el render si ya había snapshot.
  const [initialSnapshot] = useState(() => getStoredSessionSnapshot())
  const [user, setUser] = useState<AuthUser | null>(initialSnapshot?.user ?? null)
  const [companies, setCompanies] = useState<AuthCompany[]>(
    initialSnapshot?.companies ?? [],
  )
  const [isLoading, setIsLoading] = useState(!initialSnapshot)
  const [isSwitchingCompany, setIsSwitchingCompany] = useState(false)

  useEffect(() => {
    const handleSessionExpired = () => {
      logoutRequest()
      setUser(null)
      setCompanies([])
      setActiveCompanyId(null)
      invalidateQueryCache()
    }

    window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, handleSessionExpired)

    return () => {
      window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, handleSessionExpired)
    }
  }, [])

  useEffect(() => {
    setActiveCompanyId(user?.company?.id ?? null)
  }, [user?.company?.id])

  useEffect(() => {
    let isMounted = true

    async function bootstrapSession() {
      if (!hasStoredSession()) {
        if (isMounted) {
          setIsLoading(false)
        }
        return
      }

      try {
        await wakeBackend().catch(() => undefined)
        const currentSession = await fetchCurrentUser()

        if (isMounted) {
          setActiveCompanyId(currentSession.user.company?.id ?? null)
          setUser(currentSession.user)
          setCompanies(currentSession.companies)
          setStoredSessionSnapshot(
            currentSession.user,
            currentSession.companies,
          )
        }
      } catch {
        // Ya había un snapshot cacheado (pestaña recargada por el navegador,
        // no necesariamente una sesión inválida): no se fuerza logout por un
        // fallo puntual de ESTA revalidación en segundo plano (ej. cold
        // start de Render, blip de red) — un 401 real ya dispara
        // AUTH_SESSION_EXPIRED_EVENT vía el interceptor de apiClient en la
        // siguiente petición real. Forzar logout acá solo cuando este
        // chequeo era la única fuente de verdad (sin snapshot previo).
        if (!initialSnapshot) {
          logoutRequest()

          if (isMounted) {
            setActiveCompanyId(null)
            invalidateQueryCache()
            setUser(null)
            setCompanies([])
          }
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void bootstrapSession()

    return () => {
      isMounted = false
    }
  }, [])

  const login = useCallback(async (payload: LoginRequest) => {
    const session = await loginRequest(payload)
    // Admin puede entrar sin empresas; no forzar /me solo por lista vacía.
    const currentSession = session.user
      ? { user: session.user, companies: session.companies }
      : await fetchCurrentUser()

    setActiveCompanyId(currentSession.user.company?.id ?? null)
    setUser(currentSession.user)
    setCompanies(currentSession.companies)
    setStoredSessionSnapshot(currentSession.user, currentSession.companies)

    return currentSession.user
  }, [])

  const register = useCallback(async (payload: RegisterRequest) => {
    const session = await registerRequest(payload)
    const currentUser = session.user ?? (await fetchCurrentUser()).user

    setActiveCompanyId(currentUser.company?.id ?? null)
    setUser(currentUser)
    setCompanies(session.companies)
    setStoredSessionSnapshot(currentUser, session.companies)
  }, [])

  const switchCompany = useCallback(async (companyId: string) => {
    if (companyId === user?.company?.id) {
      return
    }

    setIsSwitchingCompany(true)

    try {
      const session = await switchCompanyRequest(companyId)
      const currentSession =
        session.user && session.companies.length > 0
          ? { user: session.user, companies: session.companies }
          : await fetchCurrentUser()

      setActiveCompanyId(currentSession.user.company?.id ?? null)
      setUser(currentSession.user)
      setCompanies(currentSession.companies)
      setStoredSessionSnapshot(currentSession.user, currentSession.companies)
    } finally {
      setIsSwitchingCompany(false)
    }
  }, [user?.company?.id])

  const logout = useCallback(() => {
    logoutRequest()
    setActiveCompanyId(null)
    invalidateQueryCache()
    setUser(null)
    setCompanies([])
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      companies,
      isAuthenticated: Boolean(user),
      isLoading,
      isSwitchingCompany,
      login,
      register,
      switchCompany,
      logout,
    }),
    [
      user,
      companies,
      isLoading,
      isSwitchingCompany,
      login,
      register,
      switchCompany,
      logout,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider.')
  }

  return context
}

export function getAuthErrorMessage(
  error: unknown,
  fallbackMessage: string,
): string {
  return getApiErrorMessage(error, fallbackMessage)
}
