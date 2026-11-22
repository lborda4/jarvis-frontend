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
  useEffect(() => {
    if (!companyId || admin) return
    let cancelled = false
    const refresh = async () => {
      try {
        const { data } = await apiClient.get<{ items: SubscriptionAccess[] }>('/subscriptions/access')
        if (cancelled) return
        saveSubscriptionAccess(companyId, data.items)
        setItems(data.items)
      } catch { /* The server still enforces expiration if this read fails. */ }
    }
    void refresh()
    const timer = window.setInterval(() => void refresh(), 60_000)
    window.addEventListener('focus', refresh)
    return () => { cancelled = true; window.clearInterval(timer); window.removeEventListener('focus', refresh); clearSubscriptionAccess(companyId) }
  }, [companyId, admin])
  const current = items.find(item => item.provider === 'SIIGO') ?? items.find(item => item.provider === 'JARVIS')
  return <AccessContext.Provider value={{ items: admin ? [] : items, readOnly: !admin && Boolean(current && subscriptionIsReadOnly(current)) }}>{children}</AccessContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSubscriptionAccess() { return useContext(AccessContext) }
