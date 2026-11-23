import { clearPersistedQueries, persistQuery, queryCacheScope, readPersistedQuery } from './persistentQueryCache'
interface CacheEntry<T> {
  value: T
  fetchedAt: number
  inflight?: Promise<T>
}

const store = new Map<string, CacheEntry<unknown>>()
const MAX_CACHE_ENTRIES = 200
let scope: string | null | undefined
function ensureScope() {
  const next = queryCacheScope()
  if (scope !== undefined && scope !== next) { store.clear(); clearPersistedQueries() }
  scope = next
}
function getEntry<T>(key: string): CacheEntry<T> | undefined {
  ensureScope()
  let entry = store.get(key) as CacheEntry<T> | undefined
  if (!entry) {
    const saved = readPersistedQuery(scope ?? null, key)
    if (saved) { entry = saved as CacheEntry<T>; saveEntry(key, entry) }
  }
  return entry
}

function saveEntry<T>(key: string, entry: CacheEntry<T>): void {
  ensureScope()
  store.delete(key)
  store.set(key, entry)
  if (!entry.inflight) persistQuery(scope ?? null, key, entry)
  while (store.size > MAX_CACHE_ENTRIES) {
    const oldest = store.keys().next().value
    if (oldest === undefined) break
    store.delete(oldest)
  }
}

let activeCompanyId: string | null = null

export const QUERY_STALE_MS = {
  catalogs: 30 * 60_000,
  terceros: 60_000,
  taxes: 60_000,
  credentials: 60_000,
  providers: 60_000,
  filterOptions: 30_000,
  documents: 10 * 60_000,
  jarvisHistory: 60_000,
  jarvisConfiguration: 24 * 60 * 60_000,
  jarvisQuota: 24 * 60 * 60_000,
  siigoCatalogBundle: 30 * 60_000,
} as const

export function setActiveCompanyId(companyId: string | null): void {
  const next = companyId?.trim() || null

  if (activeCompanyId && next && activeCompanyId !== next) {
    invalidateQueryCache()
  }

  if (!next && activeCompanyId) {
    invalidateQueryCache()
  }

  activeCompanyId = next
}

export function getActiveCompanyId(): string | null {
  return activeCompanyId
}

export function companyQueryKey(parts: Array<string | number | null | undefined>): string {
  const company = activeCompanyId ?? 'no-company'
  return ['company', company, ...parts.map((part) => String(part ?? ''))].join(':')
}

export function peekCachedQuery<T>(key: string): T | undefined {
  const entry = getEntry<T>(key)
  return entry?.value
}

export function isCachedQueryFresh(key: string, staleMs: number): boolean {
  const entry = getEntry<unknown>(key)
  if (!entry) return false
  return Date.now() - entry.fetchedAt < staleMs
}

export function setCachedQuery<T>(key: string, value: T): void {
  saveEntry(key, {
    value,
    fetchedAt: Date.now(),
  })
}

/** Patch cached data without extending its freshness or creating a missing entry. */
export function updateCachedQuery<T>(key: string, update: (value: T) => T): void {
  const entry = getEntry<T>(key)
  if (entry?.value !== undefined) { entry.value = update(entry.value); persistQuery(scope ?? null, key, entry) }
}

export function invalidateQueryCache(prefix?: string): void {
  ensureScope()
  clearPersistedQueries(scope, prefix)
  if (!prefix) {
    store.clear()
    return
  }

  for (const key of [...store.keys()]) {
    if (key === prefix || key.startsWith(`${prefix}:`)) {
      store.delete(key)
    }
  }
}

/**
 * Deduplica requests en vuelo y reutiliza datos frescos.
 * Si hay datos stale, los refresca y espera el nuevo valor.
 */
export async function cachedQuery<T>(
  key: string,
  staleMs: number,
  fetcher: () => Promise<T>,
  options?: { force?: boolean },
): Promise<T> {
  const existing = getEntry<T>(key)

  if (
    !options?.force &&
    existing &&
    existing.value !== undefined &&
    Date.now() - existing.fetchedAt < staleMs
  ) {
    return existing.value
  }

  if (!options?.force && existing?.inflight) {
    return existing.inflight
  }

  const inflight = Promise.resolve().then(fetcher)
    .then((value) => {
      // A mutation, company switch or newer refresh may have invalidated this request.
      if (getEntry<T>(key)?.inflight === inflight) {
        saveEntry(key, { value, fetchedAt: Date.now() })
      }
      return value
    })
    .catch((error) => {
      const current = getEntry<T>(key)
      if (current?.inflight === inflight) {
        saveEntry(key, {
          value: current.value,
          fetchedAt: current.fetchedAt,
        })
      } else if (!store.has(key)) {
        store.delete(key)
      }
      throw error
    })

  saveEntry(key, {
    value: existing?.value as T,
    fetchedAt: existing?.fetchedAt ?? 0,
    inflight,
  })

  return inflight
}

/**
 * Devuelve datos stale al instante y revalida en background.
 * Ideal para listas/catálogos donde la UI no debe esperar.
 */
export async function cachedQuerySWR<T>(
  key: string,
  staleMs: number,
  fetcher: () => Promise<T>,
): Promise<{ value: T; fromCache: boolean }> {
  const existing = getEntry<T>(key)

  if (existing && existing.fetchedAt > 0 && existing.value !== undefined) {
    const fresh = Date.now() - existing.fetchedAt < staleMs

    if (!fresh && !existing.inflight) {
      void cachedQuery(key, staleMs, fetcher).catch(() => undefined)
    }

    return { value: existing.value, fromCache: true }
  }

  const value = await cachedQuery(key, staleMs, fetcher)
  return { value, fromCache: false }
}
