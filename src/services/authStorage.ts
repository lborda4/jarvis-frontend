import type { AuthCompany, AuthTokens, AuthUser } from '../types/auth'

const ACCESS_TOKEN_KEY = 'auth.accessToken'
const REFRESH_TOKEN_KEY = 'auth.refreshToken'
const SESSION_SNAPSHOT_KEY = 'auth.sessionSnapshot'

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

export function setTokens(tokens: AuthTokens): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken)
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken)
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
  localStorage.removeItem(SESSION_SNAPSHOT_KEY)
}

interface StoredSessionSnapshot {
  user: AuthUser
  companies: AuthCompany[]
}

/** Snapshot de usuario+empresas (no los tokens, esos ya viven en
 * ACCESS_TOKEN_KEY/REFRESH_TOKEN_KEY) — permite pintar la app de una sola
 * vez cuando el navegador descarta/recarga la pestaña por inactividad, en
 * vez de bloquear con "Validando sesión..." esperando el roundtrip a
 * fetchCurrentUser. Se revalida en segundo plano igual (ver AuthContext),
 * esto solo evita que la UI espere esa respuesta para renderizar. */
export function getStoredSessionSnapshot(): StoredSessionSnapshot | null {
  const raw = localStorage.getItem(SESSION_SNAPSHOT_KEY)

  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as StoredSessionSnapshot
    return parsed?.user ? parsed : null
  } catch {
    return null
  }
}

export function setStoredSessionSnapshot(
  user: AuthUser,
  companies: AuthCompany[],
): void {
  localStorage.setItem(
    SESSION_SNAPSHOT_KEY,
    JSON.stringify({ user, companies }),
  )
}

export function hasStoredSession(): boolean {
  return Boolean(getAccessToken() && getRefreshToken())
}

export const AUTH_SESSION_EXPIRED_EVENT = 'auth:session-expired'

export function notifySessionExpired(): void {
  window.dispatchEvent(new CustomEvent(AUTH_SESSION_EXPIRED_EVENT))
}
