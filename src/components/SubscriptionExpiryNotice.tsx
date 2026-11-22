import { useState } from 'react'
import { useSubscriptionAccess } from '../context/SubscriptionAccessContext'
import { subscriptionNotice } from '../utils/subscriptionNotice'
import Banner from './Banner'
import DocumentNotice from './DocumentNotice'

export default function SubscriptionExpiryNotice() {
  const { items, readOnly } = useSubscriptionAccess()
  const [dismissed, setDismissed] = useState('')
  const access = items.find(item => item.provider === 'SIIGO') ?? items.find(item => item.provider === 'JARVIS')
  const notice = access ? subscriptionNotice(access) : null
  const key = access && notice ? `${access.provider}:${access.expiresAt}:${notice.variant}` : ''
  return <>
    {notice && dismissed !== key && <DocumentNotice key={key} {...notice} durationMs={6_000} onDismiss={() => setDismissed(key)} />}
    {readOnly && <Banner variant="error" message={notice?.variant === 'error' ? notice.message : 'Suscripción inactiva. Solo puedes consultar documentos.'} />}
  </>
}
