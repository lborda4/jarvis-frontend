import { useIntegrationSetup } from '../context/IntegrationSetupContext'
import './JarvisDocumentQuotaCard.css'

export function jarvisDocumentQuotaView(
  limit: number | null,
  used: number,
  remaining: number | null,
) {
  if (limit == null) {
    return { unlimited: true as const, remaining: null, limit: null, used, percent: 0 }
  }
  const left = remaining ?? Math.max(0, limit - used)
  const percent = limit <= 0 ? 0 : Math.min(100, Math.round((used / limit) * 100))
  return { unlimited: false as const, remaining: left, limit, used, percent }
}

export default function JarvisDocumentQuotaCard() {
  const {
    isSubscriptionActive,
    documentLimit,
    documentsUsed,
    documentsRemaining,
  } = useIntegrationSetup()

  if (!isSubscriptionActive) return null

  const quota = jarvisDocumentQuotaView(documentLimit, documentsUsed, documentsRemaining)

  return (
    <section className="settings-card jarvis-document-quota" aria-label="Cupo de documentos">
      <h2 className="settings-card__title">Cupo de documentos</h2>
      <p className="settings-card__description">
        Los envíos a la DIAN de este plan consumen unidades. El cupo lo asigna
        administración.
      </p>
      {quota.unlimited ? (
        <p className="jarvis-document-quota__remaining">Documentos ilimitados</p>
      ) : (
        <>
          <p className="jarvis-document-quota__remaining">
            {quota.remaining}{' '}
            <small>de {quota.limit} disponibles</small>
          </p>
          <div
            className="jarvis-document-quota__bar"
            role="progressbar"
            aria-valuenow={quota.percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Documentos usados del plan"
          >
            <div
              className="jarvis-document-quota__bar-fill"
              style={{ width: `${quota.percent}%` }}
            />
          </div>
          <p className="settings-card__description">
            {quota.used} enviados · Cupo total: {quota.limit}
          </p>
        </>
      )}
    </section>
  )
}
