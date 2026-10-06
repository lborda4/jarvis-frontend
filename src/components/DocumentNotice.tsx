import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import Banner from './Banner'
import { AUTO_DISMISS_ERROR_MS } from '../hooks/useAutoDismissMessage'
import './DocumentNotice.css'

interface DocumentNoticeProps {
  variant: 'success' | 'error'
  title: string
  message: string
  onDismiss: () => void
}

export default function DocumentNotice({ variant, title, message, onDismiss }: DocumentNoticeProps) {
  const onDismissRef = useRef(onDismiss)
  onDismissRef.current = onDismiss

  useEffect(() => {
    if (variant !== 'error') {
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      onDismissRef.current()
    }, AUTO_DISMISS_ERROR_MS)

    return () => window.clearTimeout(timeoutId)
  }, [message, variant])

  return createPortal(
    <div className="document-notice-layer">
    <Banner
      variant={variant}
      className="document-notice"
      message={<><strong className="document-notice__title">{title}</strong><span className="document-notice__detail">{message}</span></>}
      action={
        <button type="button" className="document-notice__close" onClick={onDismiss} aria-label="Cerrar aviso" title="Cerrar aviso">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
        </button>
      }
    />
    </div>,
    document.body,
  )
}
