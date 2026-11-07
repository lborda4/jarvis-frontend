import type { ReactNode } from 'react'

export default function AuthStatusNotice({ title, children, hint, variant = 'email' }: {
  title: string
  children: ReactNode
  hint?: string
  variant?: 'email' | 'success'
}) {
  return <div className="auth-status-notice" role="status" aria-live="polite">
    <span className="auth-status-notice__icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        {variant === 'email' ? <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m4 7 8 6 8-6" /></> : <><path d="m7 12 3 3 7-7" /><circle cx="12" cy="12" r="9" /></>}
      </svg>
    </span>
    <div className="auth-status-notice__content">
      <span className="auth-status-notice__eyebrow">{variant === 'email' ? 'Solicitud recibida' : 'Cambio completado'}</span>
      <h2>{title}</h2>
      <p>{children}</p>
    </div>
    {hint && <p className="auth-status-notice__hint">{hint}</p>}
  </div>
}
