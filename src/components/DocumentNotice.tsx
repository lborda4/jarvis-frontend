import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import Banner from './Banner'
import { clientFacingError } from '../utils/clientFacingError'
import './DocumentNotice.css'

interface DocumentNoticeProps {
  variant: 'success' | 'error'
  title: string
  message: string
  onDismiss: () => void
  durationMs?: number
  placement?: 'top' | 'center'
  action?: ReactNode
}

export default function DocumentNotice({ variant, title, message, onDismiss, durationMs, placement = 'top', action }: DocumentNoticeProps) {
  if (variant === 'error') message = clientFacingError(message)
  const onDismissRef = useRef(onDismiss)
  useEffect(() => { onDismissRef.current = onDismiss }, [onDismiss])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      onDismissRef.current()
    }, durationMs ?? (variant === 'error' ? 5_000 : 3_000))

    return () => window.clearTimeout(timeoutId)
  }, [message, variant, durationMs])

  return createPortal(
    <div className={`document-notice-layer${placement === 'center' ? ' document-notice-layer--center' : ''}`}>
    <Banner
      variant={variant}
      className="document-notice"
      message={<><strong className="document-notice__title">{title}</strong><span className="document-notice__detail">{message}</span></>}
      action={
        <>{action}<button type="button" className="document-notice__close" onClick={onDismiss} aria-label="Cerrar aviso" title="Cerrar aviso">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
        </button></>
      }
    />
    </div>,
    document.body,
  )
}
