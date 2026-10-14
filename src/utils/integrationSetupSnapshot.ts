const PREFIX = 'jarvis:setup-snapshot:'
const MAX_AGE_MS = 24 * 60 * 60_000
const key = (userId: string, companyId: string) => `${PREFIX}${encodeURIComponent(userId)}:${encodeURIComponent(companyId)}`

export function readIntegrationSetupSnapshot<T extends { integrationMode: string; integrationProviders: string[] }>(userId?: string, companyId?: string): T | null {
  if (!userId || !companyId) return null
  try {
    const stored = JSON.parse(sessionStorage.getItem(key(userId, companyId)) ?? 'null') as { savedAt: number; value: T } | null
    if (!stored || !Number.isFinite(stored.savedAt) || Date.now() - stored.savedAt > MAX_AGE_MS || !['jarvis', 'siigo'].includes(stored.value?.integrationMode) || !Array.isArray(stored.value.integrationProviders)) return null
    return stored.value
  } catch { return null }
}

export function saveIntegrationSetupSnapshot(userId: string, companyId: string, value: unknown): void {
  try { sessionStorage.setItem(key(userId, companyId), JSON.stringify({ savedAt: Date.now(), value })) } catch { /* In-memory setup remains available. */ }
}

export function clearIntegrationSetupSnapshots(): void {
  try {
    for (let index = sessionStorage.length - 1; index >= 0; index--) {
      const entry = sessionStorage.key(index)
      if (entry?.startsWith(PREFIX)) sessionStorage.removeItem(entry)
    }
  } catch { /* Browser storage may be unavailable. */ }
}

export function removeIntegrationSetupSnapshot(userId: string, companyId: string): void {
  try { sessionStorage.removeItem(key(userId, companyId)) } catch { /* Browser storage may be unavailable. */ }
}
