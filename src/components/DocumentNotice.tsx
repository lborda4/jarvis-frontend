import Banner from './Banner'
import './DocumentNotice.css'

interface DocumentNoticeProps {
  variant: 'success' | 'error'
  title: string
  message: string
  onDismiss: () => void
}

export default function DocumentNotice({ variant, title, message, onDismiss }: DocumentNoticeProps) {
  return (
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
  )
}
