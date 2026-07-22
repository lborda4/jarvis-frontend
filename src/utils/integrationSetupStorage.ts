export type AuthEntryMode = 'register' | 'login'

const AUTH_ENTRY_MODE_KEY = 'jarvis_auth_entry_mode'
const INTEGRATION_CONFIGURED_KEY = 'jarvis_integration_configured'

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

export function markIntegrationConfigured(): void {
  sessionStorage.setItem(INTEGRATION_CONFIGURED_KEY, 'true')
}

export function isIntegrationConfiguredLocally(): boolean {
  return sessionStorage.getItem(INTEGRATION_CONFIGURED_KEY) === 'true'
}

export function clearIntegrationConfigured(): void {
  sessionStorage.removeItem(INTEGRATION_CONFIGURED_KEY)
}

export const markSiigoConfigured = markIntegrationConfigured
export const isSiigoConfiguredLocally = isIntegrationConfiguredLocally
export const clearSiigoConfigured = clearIntegrationConfigured
