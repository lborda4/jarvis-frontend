/** Only reusable catalogs persist; company/customer documents and credentials stay in memory. */
export interface PersistedQueryEntry { value: unknown; fetchedAt: number }
const PREFIX = 'jarvis.query-cache.v1:'
const MAX_ENTRY_CHARS = 750_000
const MAX_TOTAL_CHARS = 2_000_000
const MAX_AGE = 24 * 60 * 60_000

export function queryCacheScope(): string | null {
  try {
    const user = JSON.parse(localStorage.getItem('auth.sessionSnapshot') ?? 'null')?.user
    return user?.id && user?.role ? JSON.stringify([user.id, user.role]) : null
  } catch { return null }
}
function eligible(key: string) {
  return /^admin:(plans|top-ups|cities)$/.test(key) || /^advisor:catalog(?::|$)/.test(key)
    || /^company:(?!no-company:)[^:]+:(siigo:catalog-bundle|jarvis:catalogs)$/.test(key)
}
function storageKeys() { return Array.from({ length: sessionStorage.length }, (_, i) => sessionStorage.key(i)).filter((key): key is string => Boolean(key?.startsWith(PREFIX))) }
function storageKey(scope: string, key: string) { return PREFIX + encodeURIComponent(scope) + ':' + key }

export function readPersistedQuery(scope: string | null, key: string): PersistedQueryEntry | undefined {
  if (!scope || !eligible(key)) return
  try {
    const name = storageKey(scope, key), raw = sessionStorage.getItem(name)
    if (!raw) return
    const entry = JSON.parse(raw)
    const age = Date.now() - entry.fetchedAt
    if (!Number.isFinite(entry.fetchedAt) || age < 0 || age >= MAX_AGE || entry.value === undefined) { sessionStorage.removeItem(name); return }
    return entry
  } catch { return }
}
export function persistQuery(scope: string | null, key: string, entry: PersistedQueryEntry) {
  if (!scope || !eligible(key) || entry.value === undefined) return
  try {
    // Never persist a failed catalog or a credential-bearing response.
    const raw = JSON.stringify(entry)
    if (raw.length > MAX_ENTRY_CHARS || /"(?:password|token|accessToken|refreshToken|technicalKey|credentials|inviteCode)"\s*:/i.test(raw)
      || /"\w*Error"\s*:\s*"/.test(raw)) return
    const name = storageKey(scope, key)
    sessionStorage.removeItem(name)
    let size = raw.length
    const entries = storageKeys().map(name => ({ name, raw: sessionStorage.getItem(name) ?? '' }))
    for (const item of entries) size += item.raw.length
    entries.sort((a, b) => { try { return JSON.parse(a.raw).fetchedAt - JSON.parse(b.raw).fetchedAt } catch { return 0 } })
    for (const item of entries) { if (size <= MAX_TOTAL_CHARS) break; sessionStorage.removeItem(item.name); size -= item.raw.length }
    sessionStorage.setItem(name, raw)
  } catch { /* Full/blocked storage falls back to the in-memory cache. */ }
}
export function clearPersistedQueries(scope?: string | null, prefix?: string) {
  try {
    const scopePrefix = scope ? PREFIX + encodeURIComponent(scope) + ':' : PREFIX
    for (const name of storageKeys()) {
      if (!name.startsWith(scopePrefix)) continue
      const key = name.slice(scopePrefix.length)
      if (!prefix || key === prefix || key.startsWith(prefix + ':')) sessionStorage.removeItem(name)
    }
  } catch { /* Storage is optional. */ }
}
