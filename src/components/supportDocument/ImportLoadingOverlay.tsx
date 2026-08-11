import { useEffect, useState } from 'react'
import type { DocumentWorkspaceProvider } from '../../constants/documentWorkspaceConfig'
import './ImportLoadingOverlay.css'

interface ImportLoadingOverlayProps {
  provider?: DocumentWorkspaceProvider
}

const TIP_ROTATE_MS = 2600

function buildTips(provider: DocumentWorkspaceProvider): string[] {
  const systemLabel = provider === 'JARVIS' ? 'Jarvis' : 'SIIGO'

  return [
    'Leyendo el archivo Excel...',
    'Creando los documentos...',
    `Validando la información con ${systemLabel}...`,
    'Ya casi termina, un momento más...',
  ]
}

/** Loader de pantalla completa mientras se importa y valida el Excel — el
 * proceso puede tardar, así que bloquea la interacción y explica qué pasa. */
function ImportLoadingOverlay({ provider = 'SIIGO' }: ImportLoadingOverlayProps) {
  const tips = buildTips(provider)
  const [tipIndex, setTipIndex] = useState(0)

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setTipIndex((current) => (current + 1) % tips.length)
    }, TIP_ROTATE_MS)

    return () => {
      window.clearInterval(timerId)
    }
  }, [tips.length])

  return (
    <div
      className="import-loading-overlay"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="import-loading-overlay__card">
        <span className="import-loading-overlay__spinner" aria-hidden="true" />
        <strong className="import-loading-overlay__title">Importando Excel</strong>
        <span
          key={tipIndex}
          className="import-loading-overlay__tip"
        >
          {tips[tipIndex]}
        </span>
        <span className="import-loading-overlay__pulse" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <p className="import-loading-overlay__hint">
          No cierres ni recargues esta pestaña mientras termina.
        </p>
      </div>
    </div>
  )
}

export default ImportLoadingOverlay
