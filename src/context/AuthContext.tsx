import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { AuthUser, LoginRequest, RegisterRequest } from '../types/auth'
import { getApiErrorMessage } from '../services/apiClient'
import {
  fetchCurrentUser,
  login as loginRequest,
  logout as logoutRequest,
  register as registerRequest,
} from '../services/authService'
import {
  AUTH_SESSION_EXPIRED_EVENT,
  hasStoredSession,
} from '../services/authStorage'

interface AuthContextValue {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (payload: LoginRequest) => Promise<void>
  register: (payload: RegisterRequest) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const handleSessionExpired = () => {
      logoutRequest()
      setUser(null)
    }

    window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, handleSessionExpired)

    return () => {
      window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, handleSessionExpired)
    }
  }, [])

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
        const currentUser = await fetchCurrentUser()

        if (isMounted) {
          setUser(currentUser)
        }
      } catch {
        logoutRequest()

        if (isMounted) {
          setUser(null)
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
    const currentUser = session.user ?? (await fetchCurrentUser())
    setUser(currentUser)
  }, [])

  const register = useCallback(async (payload: RegisterRequest) => {
    const session = await registerRequest(payload)
    const currentUser = session.user ?? (await fetchCurrentUser())
    setUser(currentUser)
  }, [])

  const logout = useCallback(() => {
    logoutRequest()
    setUser(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      login,
      register,
      logout,
    }),
    [user, isLoading, login, register, logout],
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
