import { useEffect } from 'react'
import { useSubscriptionAccess } from '../context/SubscriptionAccessContext'
import { useIntegrationSetup } from '../context/IntegrationSetupContext'
import { observeJarvisQuota } from '../services/jarvisQuotaRefresh'
import './JarvisDocumentQuotaNotice.css'

export default function JarvisDocumentQuotaNotice() {
  const { readOnly } = useSubscriptionAccess()
  const {
    isJarvisCompany,
    isCheckingSetup,
    isSubscriptionActive,
    documentLimit,
    documentsUsed,
    documentsRemaining,
    refreshSetupStatus,
  } = useIntegrationSetup()

  useEffect(() => {
    if (!isJarvisCompany) return

    return observeJarvisQuota(force => refreshSetupStatus({ background: true, quotaOnly: true, force }))
  }, [isJarvisCompany, refreshSetupStatus])

  const remaining = documentsRemaining ?? Math.max(0, (documentLimit ?? 0) - documentsUsed)
  if (readOnly || !isJarvisCompany || isCheckingSetup || !isSubscriptionActive || documentLimit == null || remaining > 0) {
    return null
  }

  return (
    <section className="jarvis-quota-notice" role="alert" aria-labelledby="jarvis-quota-notice-title">
      <h2 id="jarvis-quota-notice-title">Te has quedado sin documentos disponibles</h2>
      <p>Has utilizado todos los documentos electrónicos de tu paquete actual.</p>
      <p>Para continuar emitiendo documentos, comunícate con tu asesor de JARVIS y solicita una nueva recarga.</p>
    </section>
  )
}
