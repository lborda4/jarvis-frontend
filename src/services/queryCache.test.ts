import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cachedQuery, cachedQuerySWR, companyQueryKey, invalidateQueryCache, peekCachedQuery, setActiveCompanyId, setCachedQuery } from './queryCache'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}
beforeEach(() => { invalidateQueryCache(); setActiveCompanyId('a') })
describe('query cache consistency', () => {
  it('shares concurrent requests and reuses fresh results', async () => {
    const fetch = vi.fn().mockResolvedValue(['saved'])
    expect(await Promise.all([cachedQuery('key', 60000, fetch), cachedQuery('key', 60000, fetch)])).toEqual([['saved'], ['saved']])
    await cachedQuery('key', 60000, fetch)
    expect(fetch).toHaveBeenCalledTimes(1)
  })
  it('does not restore invalidated data when an older request completes', async () => {
    const pending = deferred<string>()
    const request = cachedQuery('key', 60000, () => pending.promise)
    invalidateQueryCache('key')
    pending.resolve('old')
    await request
    expect(peekCachedQuery('key')).toBeUndefined()
  })
  it('keeps the latest forced refresh when responses arrive out of order', async () => {
    const pending = deferred<string>()
    const old = cachedQuery('key', 60000, () => pending.promise)
    await cachedQuery('key', 60000, async () => 'new', { force: true })
    pending.resolve('old')
    await old
    expect(peekCachedQuery('key')).toBe('new')
  })
  it('clears company data and prevents late repopulation', async () => {
    const key = companyQueryKey(['history'])
    const pending = deferred<string>()
    const old = cachedQuery(key, 60000, () => pending.promise)
    setActiveCompanyId('b')
    pending.resolve('company-a')
    await old
    expect(peekCachedQuery(key)).toBeUndefined()
    expect(companyQueryKey(['history'])).not.toBe(key)
  })
  it('retains stale data when background revalidation fails without an unhandled rejection', async () => {
    setCachedQuery('key', 'cached')
    const fetch = vi.fn().mockRejectedValue(new Error('offline'))
    expect(await cachedQuerySWR('key', -1, fetch)).toEqual({ value: 'cached', fromCache: true })
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(peekCachedQuery('key')).toBe('cached')
  })
  it('bounds retained entries', () => {
    for (let i = 0; i < 220; i++) setCachedQuery(`key-${i}`, i)
    expect(peekCachedQuery('key-0')).toBeUndefined()
    expect(peekCachedQuery('key-219')).toBe(219)
  })
})
