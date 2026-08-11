import type { ReactNode } from 'react'
import { AlertIcon, CheckIcon } from './icons/SidebarIcons'
import './Banner.css'

export type BannerVariant = 'error' | 'success' | 'warning' | 'loading'

const ROOT_CLASS: Record<BannerVariant, string> = {
  error: 'error-message',
  success: 'success-message',
  warning: 'warning-message',
  loading: 'loading-indicator',
}

const ROLE: Record<BannerVariant, 'alert' | 'status'> = {
  error: 'alert',
  success: 'status',
  warning: 'status',
  loading: 'status',
}

interface BannerProps {
  variant: BannerVariant
  message: ReactNode
  /** Acción opcional (botón de reintentar, enlace, etc.) alineada a la derecha. */
  action?: ReactNode
  className?: string
}

function Banner({ variant, message, action, className }: BannerProps) {
  return (
    <div
      className={[ROOT_CLASS[variant], className].filter(Boolean).join(' ')}
      role={ROLE[variant]}
      aria-live={variant === 'loading' ? 'polite' : undefined}
    >
      {variant === 'loading' ? (
        <span className="loading-indicator__spinner" aria-hidden="true" />
      ) : variant === 'success' ? (
        <CheckIcon className="banner__icon" />
      ) : (
        <AlertIcon className="banner__icon" />
      )}
      <span className="banner__message">{message}</span>
      {action && <span className="banner__action">{action}</span>}
    </div>
  )
}

export default Banner
