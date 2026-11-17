import { useEffect, useState } from 'react'
import { companyQueryKey, peekCachedQuery, setCachedQuery } from '../../services/queryCache'
import type { PayrollDetail, PayrollState } from '../../services/payrollService'

export function hasUnsavedPayrollNovelties(ids: string[]) {
  const drafts = peekCachedQuery<Record<string, PayrollDetail>>(companyQueryKey(['payroll-novelty-drafts'])) ?? {}
  return ids.some(id => Boolean(drafts[id]))
}

// Kept in the company-scoped memory cache, including when navigating between payroll views.
// Logging out or switching companies clears this cache with the other company data.
export function usePayrollNoveltyDrafts(ids: string[]) {
  const key = companyQueryKey(['payroll-novelty-drafts'])
  const [, refresh] = useState(0)
  const drafts = peekCachedQuery<Record<string, PayrollDetail>>(key) ?? {}
  const dirty = ids.some(id => Boolean(drafts[id]))
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
  const stage = (detail: PayrollDetail, state: PayrollState) => {
    const current = peekCachedQuery<Record<string, PayrollDetail>>(key) ?? {}
    const next = { ...current, [detail.id]: { ...(current[detail.id] ?? detail), state, status: 'DRAFT' } }
    setCachedQuery(key, next)
    refresh(value => value + 1)
    return next[detail.id]
  }
  const clear = (savedIds: string[]) => {
    const next = { ...(peekCachedQuery<Record<string, PayrollDetail>>(key) ?? {}) }
    for (const id of savedIds) delete next[id]
    setCachedQuery(key, next)
    refresh(value => value + 1)
  }
  return { drafts, dirty, stage, clear }
}
