import { useEffect, useState } from 'react'
import Button from '../../components/Button'
import DocumentNotice from '../../components/DocumentNotice'

const noticeDurationMs = 10_000

export function PayrollErrorNotice({ message, onDismiss, onRetry }: {
  message: string
  onDismiss: () => void
  onRetry?: () => void
}) {
  return <DocumentNotice variant="error" title="Ha ocurrido un error" message={message}
    onDismiss={onDismiss} durationMs={noticeDurationMs} placement="center"
    action={onRetry && <Button variant="ghost" onClick={onRetry}>Reintentar</Button>} />
}

export default function PayrollNotice({ message, variant = 'warning' }: { message: string; variant?: 'warning' | 'success' }) {
  const [dismissedMessage, setDismissedMessage] = useState<string | null>(null)
  useEffect(() => {
    const timeout = window.setTimeout(() => setDismissedMessage(message), noticeDurationMs)
    return () => window.clearTimeout(timeout)
  }, [message])
  if (dismissedMessage === message) return null
  return <p role="status" className={`payroll__notice${variant === 'success' ? ' payroll__notice--success' : ''}`}>{message}</p>
}
