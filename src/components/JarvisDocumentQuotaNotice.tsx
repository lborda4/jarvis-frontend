import { useEffect } from 'react'
import { useIntegrationSetup } from '../context/IntegrationSetupContext'
import { apiClient } from '../services/apiClient'
import { companyQueryKey, invalidateQueryCache } from '../services/queryCache'
import './JarvisDocumentQuotaNotice.css'

export default function JarvisDocumentQuotaNotice() {
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

    const refreshQuota = () => {
      invalidateQueryCache(companyQueryKey(['jarvis', 'credentials-status']))
      void refreshSetupStatus({ background: true })
    }
    // Actualiza el aviso tras emitir documentos, eventos RADIAN o nómina,
    // incluso si el servidor rechaza un envío por cupo agotado.
    const shouldRefresh = (config?: { method?: string; url?: string }) =>
      /^(post|put|patch|delete)$/i.test(config?.method ?? '') &&
      /^\/(?:integrations\/jarvis|electronic-documents)(?:\/|$)/.test(config?.url ?? '')
    const interceptor = apiClient.interceptors.response.use(
      response => {
        if (shouldRefresh(response.config)) refreshQuota()
        return response
      },
      error => {
        if (error.response?.status === 403 && shouldRefresh(error.config)) refreshQuota()
        return Promise.reject(error)
      },
    )
    window.addEventListener('focus', refreshQuota)
    return () => {
      apiClient.interceptors.response.eject(interceptor)
      window.removeEventListener('focus', refreshQuota)
    }
  }, [isJarvisCompany, refreshSetupStatus])

  const remaining = documentsRemaining ?? Math.max(0, (documentLimit ?? 0) - documentsUsed)
  if (!isJarvisCompany || isCheckingSetup || !isSubscriptionActive || documentLimit == null || remaining > 0) {
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
