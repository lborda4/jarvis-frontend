import { useEffect, useState } from 'react'

export const AUTO_DISMISS_MESSAGE_MS = 15_000
export const AUTO_DISMISS_ERROR_MS = 5_000

export function useAutoDismissMessage(
  durationMs = AUTO_DISMISS_MESSAGE_MS,
): [string | null, (message: string | null) => void] {
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!message) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      setMessage(null)
    }, durationMs)

    return () => window.clearTimeout(timeoutId)
  }, [durationMs, message])

  return [message, setMessage]
}

export function useAutoDismissOnValue(
  value: string | null,
  onDismiss: () => void,
  durationMs = AUTO_DISMISS_MESSAGE_MS,
): void {
  useEffect(() => {
    if (!value) {
      return undefined
    }

    const timeoutId = window.setTimeout(onDismiss, durationMs)

    return () => window.clearTimeout(timeoutId)
  }, [durationMs, onDismiss, value])
}
