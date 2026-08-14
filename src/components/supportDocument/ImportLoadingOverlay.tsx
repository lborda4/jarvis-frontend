import { useEffect, useState } from 'react'
import './ImportLoadingOverlay.css'

interface ImportLoadingOverlayProps {
  title: string
  tips: string[]
  hint?: string | null
}

const TIP_ROTATE_MS = 2600

/** Loader de pantalla completa reutilizado en cada etapa larga del flujo
 * (importar Excel, revisar proveedores/terceros, enviar a SIIGO/Jarvis) — el
 * título y los mensajes cambian según la etapa, pero solo se muestra uno a
 * la vez, para no apilar loaders distintos en pantalla. */
function ImportLoadingOverlay({
  title,
  tips,
  hint = 'No cierres ni recargues esta pestaña mientras termina.',
}: ImportLoadingOverlayProps) {
  const [tipIndex, setTipIndex] = useState(0)

  useEffect(() => {
    if (tips.length <= 1) {
      return
    }

    const timerId = window.setInterval(() => {
      setTipIndex((current) => (current + 1) % tips.length)
    }, TIP_ROTATE_MS)

    return () => {
      window.clearInterval(timerId)
    }
  }, [tips])

  const currentTip = tips[tipIndex] ?? tips[0] ?? ''

  return (
    <div
      className="import-loading-overlay"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="import-loading-overlay__card">
        <span className="import-loading-overlay__spinner" aria-hidden="true" />
        <strong className="import-loading-overlay__title">{title}</strong>
        <span key={currentTip} className="import-loading-overlay__tip">
          {currentTip}
        </span>
        <span className="import-loading-overlay__pulse" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        {hint && <p className="import-loading-overlay__hint">{hint}</p>}
      </div>
    </div>
  )
}

export default ImportLoadingOverlay
