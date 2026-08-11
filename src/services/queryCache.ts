interface CacheEntry<T> {
  value: T
  fetchedAt: number
  inflight?: Promise<T>
}

const store = new Map<string, CacheEntry<unknown>>()

let activeCompanyId: string | null = null

export const QUERY_STALE_MS = {
  catalogs: 5 * 60_000,
  terceros: 60_000,
  credentials: 60_000,
  providers: 60_000,
  filterOptions: 30_000,
  documents: 15_000,
  siigoCatalogBundle: 5 * 60_000,
} as const

export function setActiveCompanyId(companyId: string | null): void {
  const next = companyId?.trim() || null

  if (activeCompanyId && next && activeCompanyId !== next) {
    invalidateQueryCache()
  }

  if (!next) {
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
  const entry = store.get(key) as CacheEntry<T> | undefined
  return entry?.value
}

export function isCachedQueryFresh(key: string, staleMs: number): boolean {
  const entry = store.get(key)
  if (!entry) return false
  return Date.now() - entry.fetchedAt < staleMs
}

export function setCachedQuery<T>(key: string, value: T): void {
  const existing = store.get(key) as CacheEntry<T> | undefined
  store.set(key, {
    value,
    fetchedAt: Date.now(),
    inflight: existing?.inflight,
  })
}

export function invalidateQueryCache(prefix?: string): void {
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
  const existing = store.get(key) as CacheEntry<T> | undefined

  if (
    !options?.force &&
    existing &&
    Date.now() - existing.fetchedAt < staleMs
  ) {
    return existing.value
  }

  if (!options?.force && existing?.inflight) {
    return existing.inflight
  }

  const inflight = fetcher()
    .then((value) => {
      store.set(key, { value, fetchedAt: Date.now() })
      return value
    })
    .catch((error) => {
      const current = store.get(key) as CacheEntry<T> | undefined
      if (current?.inflight === inflight) {
        store.set(key, {
          value: current.value,
          fetchedAt: current.fetchedAt,
        })
      } else if (!store.has(key)) {
        store.delete(key)
      }
      throw error
    })

  store.set(key, {
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
  const existing = store.get(key) as CacheEntry<T> | undefined

  if (existing && existing.fetchedAt > 0 && existing.value !== undefined) {
    const fresh = Date.now() - existing.fetchedAt < staleMs

    if (!fresh && !existing.inflight) {
      const inflight = fetcher()
        .then((value) => {
          store.set(key, { value, fetchedAt: Date.now() })
          return value
        })
        .catch((error) => {
          const current = store.get(key) as CacheEntry<T> | undefined
          if (current?.inflight === inflight) {
            store.set(key, {
              value: current.value,
              fetchedAt: current.fetchedAt,
            })
          }
          throw error
        })

      store.set(key, {
        value: existing.value,
        fetchedAt: existing.fetchedAt,
        inflight,
      })
    }

    return { value: existing.value, fromCache: true }
  }

  const value = await cachedQuery(key, staleMs, fetcher)
  return { value, fromCache: false }
}
