import { cachedQuery, companyQueryKey } from '../services/queryCache'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { apiClient } from '../services/apiClient'
import { clearSubscriptionAccess, saveSubscriptionAccess, subscriptionIsReadOnly, type SubscriptionAccess } from '../services/subscriptionAccessStore'

const AccessContext = createContext<{ items: SubscriptionAccess[]; readOnly: boolean }>({ items: [], readOnly: false })

export function SubscriptionAccessProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth()
  const { pathname } = useLocation()
  const companyId = isAuthenticated ? user?.company?.id : undefined
  return <CompanyAccess key={`${user?.id}:${companyId}`} companyId={companyId} admin={pathname.startsWith('/admin')}>
    {children}
  </CompanyAccess>
}

function CompanyAccess({ companyId, admin, children }: { companyId?: string; admin: boolean; children: ReactNode }) {
  const [items, setItems] = useState<SubscriptionAccess[]>([])
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (!companyId || admin) return
    let cancelled = false
    const refresh = async () => {
      try {
        const data = await cachedQuery(companyQueryKey(['subscription-access']), 5 * 60_000, async () => (await apiClient.get<{ items: SubscriptionAccess[] }>('/subscriptions/access')).data)
        if (cancelled) return
        saveSubscriptionAccess(companyId, data.items)
        setItems(data.items)
      } catch { /* The server still enforces expiration if this read fails. */ }
    }
    void refresh()
    const timer = window.setInterval(() => { if (!document.hidden) void refresh() }, 5 * 60_000)
    const clock = window.setInterval(() => setNow(Date.now()), 60_000)
    const visible = () => { if (!document.hidden) { setNow(Date.now()); void refresh() } }
    document.addEventListener('visibilitychange', visible)
    window.addEventListener('focus', refresh)
    return () => { cancelled = true; window.clearInterval(timer); window.clearInterval(clock); document.removeEventListener('visibilitychange', visible); window.removeEventListener('focus', refresh); clearSubscriptionAccess(companyId) }
  }, [companyId, admin])
  const current = items.find(item => item.provider === 'SIIGO') ?? items.find(item => item.provider === 'JARVIS')
  return <AccessContext.Provider value={{ items: admin ? [] : items, readOnly: !admin && Boolean(current && subscriptionIsReadOnly(current, now)) }}>{children}</AccessContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSubscriptionAccess() { return useContext(AccessContext) }
