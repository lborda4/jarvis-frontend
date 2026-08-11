import { useEffect, useState } from 'react'
import type { DocumentWorkspaceProvider } from '../../constants/documentWorkspaceConfig'

export type DocumentWorkspaceWorkingMode = 'importing' | 'resuming'

interface DocumentWorkspaceWorkingBannerProps {
  mode: DocumentWorkspaceWorkingMode
  provider?: DocumentWorkspaceProvider
}

const TIP_ROTATE_MS = 2800

function buildCopy(
  mode: DocumentWorkspaceWorkingMode,
  provider: DocumentWorkspaceProvider,
): { title: string; tips: string[] } {
  const thirdPartyLabel = provider === 'JARVIS' ? 'terceros' : 'proveedores'
  const systemLabel = provider === 'JARVIS' ? 'Jarvis' : 'SIIGO'

  if (mode === 'importing') {
    return {
      title: 'Importando Excel',
      tips: [
        'Leyendo el archivo…',
        'Creando los documentos…',
        'Preparando la validación…',
      ],
    }
  }

  return {
    title: `Revisando ${thirdPartyLabel}`,
    tips: [
      `Consultando si el tercero ya existe en ${systemLabel}…`,
      'Validando cada documento importado…',
      'Actualizando el estado de la tabla…',
      'Esto puede tomar unos segundos…',
    ],
  }
}

function DocumentWorkspaceWorkingBanner({
  mode,
  provider = 'SIIGO',
}: DocumentWorkspaceWorkingBannerProps) {
  const { title, tips } = buildCopy(mode, provider)
  const [tipIndex, setTipIndex] = useState(0)

  useEffect(() => {
    setTipIndex(0)

    if (tips.length <= 1) {
      return
    }

    const timerId = window.setInterval(() => {
      setTipIndex((current) => (current + 1) % tips.length)
    }, TIP_ROTATE_MS)

    return () => {
      window.clearInterval(timerId)
    }
  }, [mode, provider, tips.length])

  return (
    <div
      className="document-working-banner"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="document-working-banner__spinner" aria-hidden="true" />
      <div className="document-working-banner__copy">
        <strong className="document-working-banner__title">{title}</strong>
        <span
          key={`${mode}-${tipIndex}`}
          className="document-working-banner__tip"
        >
          {tips[tipIndex]}
        </span>
      </div>
      <span className="document-working-banner__pulse" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
    </div>
  )
}

export default DocumentWorkspaceWorkingBanner
