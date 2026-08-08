import { useCallback, useEffect, useState } from 'react'
import { resetBackendWake, wakeBackend } from '../services/healthService'

const SLOW_LOADING_MS = 2_500
/** Si el cold start sigue “lento” demasiado tiempo, remonta y reintenta el health. */
const AUTO_RERENDER_MS = 12_000
const MAX_AUTO_RERENDERS = 3

export interface BackendWakeupState {
  isReady: boolean
  isSlow: boolean
  isWaking: boolean
  error: string | null
  attempt: number
  ensureReady: () => Promise<void>
  retryWake: () => void
  loadingMessage: string
}

/**
 * Dispara el wake del backend al montar y, si el cold start se queda colgado,
 * remonta el ciclo de health para volver a comprobar si ya cargó.
 */
export function useBackendWakeup(options?: {
  enabled?: boolean
}): BackendWakeupState {
  const enabled = options?.enabled ?? true
  const [isReady, setIsReady] = useState(!enabled)
  const [isSlow, setIsSlow] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  const ensureReady = useCallback(async () => {
    setError(null)
    await wakeBackend()
    setIsReady(true)
    setIsSlow(false)
  }, [])

  const retryWake = useCallback(() => {
    resetBackendWake()
    setIsReady(false)
    setIsSlow(false)
    setError(null)
    setAttempt((current) => current + 1)
  }, [])

  useEffect(() => {
    if (!enabled) {
      return
    }

    let cancelled = false
    const slowTimer = window.setTimeout(() => {
      if (!cancelled) {
        setIsSlow(true)
      }
    }, SLOW_LOADING_MS)

    void wakeBackend({ force: attempt > 0 })
      .then(() => {
        if (!cancelled) {
          setIsReady(true)
          setIsSlow(false)
          setError(null)
        }
      })
      .catch((wakeError) => {
        if (cancelled) return
        if (
          wakeError instanceof DOMException &&
          wakeError.name === 'AbortError'
        ) {
          return
        }
        setError(
          'El servicio está tardando en iniciar. Reintentando automáticamente...',
        )
        setIsReady(false)
      })
      .finally(() => {
        window.clearTimeout(slowTimer)
      })

    return () => {
      cancelled = true
      window.clearTimeout(slowTimer)
    }
  }, [enabled, attempt])

  useEffect(() => {
    if (!enabled || isReady || attempt >= MAX_AUTO_RERENDERS) {
      return
    }

    if (!isSlow && !error) {
      return
    }

    const rerenderTimer = window.setTimeout(() => {
      retryWake()
    }, AUTO_RERENDER_MS)

    return () => {
      window.clearTimeout(rerenderTimer)
    }
  }, [enabled, isReady, isSlow, error, attempt, retryWake])

  useEffect(() => {
    if (!enabled || isReady || attempt < MAX_AUTO_RERENDERS || !error) {
      return
    }

    setError(
      'El servicio está tardando en iniciar. Puedes reintentar en un momento.',
    )
    setIsReady(true)
  }, [enabled, isReady, attempt, error])

  const isWaking = enabled && !isReady
  const loadingMessage =
    attempt > 0
      ? `Reintentando conexión con el servicio (${attempt + 1})...`
      : isSlow
        ? 'Estamos iniciando el servicio, espera un momento...'
        : 'Cargando...'

  return {
    isReady,
    isSlow,
    isWaking,
    error,
    attempt,
    ensureReady,
    retryWake,
    loadingMessage,
  }
}
