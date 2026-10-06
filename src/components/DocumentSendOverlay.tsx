import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import './DocumentSendOverlay.css'

const EXIT_MS = 180

function DocumentSendOverlay({
  open,
  documentTitle,
}: {
  open: boolean
  documentTitle: string
}) {
  const [mounted, setMounted] = useState(open)

  useEffect(() => {
    if (open) {
      setMounted(true)
      return
    }

    const timer = window.setTimeout(() => setMounted(false), EXIT_MS)
    return () => window.clearTimeout(timer)
  }, [open])

  useEffect(() => {
    if (!mounted) return

    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [mounted])

  if (!mounted) return null

  return createPortal(
    <div
      className="document-send-overlay"
      data-closing={!open || undefined}
      role="status"
      aria-live="assertive"
      aria-busy="true"
    >
      <div className="document-send-overlay__card">
        <div className="document-send-overlay__mark" aria-hidden="true">
          <span className="document-send-overlay__halo" />
          <span className="document-send-overlay__ring document-send-overlay__ring--outer" />
          <span className="document-send-overlay__ring document-send-overlay__ring--inner" />
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" width="22" height="22">
            <line x1="22" y1="2" x2="11" y2="13" strokeLinecap="round" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" strokeLinejoin="round" />
          </svg>
        </div>
        <strong className="document-send-overlay__title">
          Enviando {documentTitle.toLowerCase()}
        </strong>
        <p className="document-send-overlay__copy">Transmitiendo el documento a DIAN</p>
        <p className="document-send-overlay__hint">
          No cierres esta pestaña. Suele tardar unos segundos.
        </p>
      </div>
    </div>,
    document.body,
  )
}

export default DocumentSendOverlay
