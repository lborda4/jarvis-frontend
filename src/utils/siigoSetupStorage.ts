export type AuthEntryMode = 'register' | 'login'

const AUTH_ENTRY_MODE_KEY = 'jarvis_auth_entry_mode'
const SIIGO_CONFIGURED_KEY = 'jarvis_siigo_configured'

export function setAuthEntryMode(mode: AuthEntryMode): void {
  sessionStorage.setItem(AUTH_ENTRY_MODE_KEY, mode)
}

export function getAuthEntryMode(): AuthEntryMode | null {
  const value = sessionStorage.getItem(AUTH_ENTRY_MODE_KEY)

  if (value === 'register' || value === 'login') {
    return value
  }

  return null
}

export function markSiigoConfigured(): void {
  sessionStorage.setItem(SIIGO_CONFIGURED_KEY, 'true')
}

export function isSiigoConfiguredLocally(): boolean {
  return sessionStorage.getItem(SIIGO_CONFIGURED_KEY) === 'true'
}

export function clearSiigoConfigured(): void {
  sessionStorage.removeItem(SIIGO_CONFIGURED_KEY)
}
