import { getActiveCompanyId, invalidateQueryCache } from './queryCache'

/** Invalidate successful business writes; never cache write responses or suppress them. */
export function invalidateBusinessReads(method: string, path: string) {
  if (['get', 'head', 'options'].includes(method.toLowerCase())) return
  path = path.split('?')[0]
  if (path.startsWith('/admin/plans')) {
    for (const prefix of ['admin:plans', 'advisor:catalog', 'admin:companies', 'admin:company-details', 'advisor:dashboard']) invalidateQueryCache(prefix)
  }
  if (/^\/admin\/(companies|advisors|advisor-sales)(\/|$)/.test(path) || path.startsWith('/advisor/companies')) {
    for (const prefix of ['admin:companies', 'admin:company-details', 'admin:advisors', 'advisor:dashboard', 'advisor:commissions']) invalidateQueryCache(prefix)
  }
  if (/^\/admin\/(companies|advisor-sales)(\/|$)/.test(path)) {
    const companyId = path.match(/^\/admin\/companies\/([^/]+)/)?.[1] ?? getActiveCompanyId()
    if (companyId) for (const suffix of ['subscription-access', 'jarvis:credentials-status', 'jarvis:subscription-status', 'siigo:credentials-status']) invalidateQueryCache('company:' + companyId + ':' + suffix)
  }
}
