import { useCallback, useEffect, useState } from 'react'
import { wakeBackend } from '../services/healthService'

const SLOW_LOADING_MS = 2_500

export interface BackendWakeupState {
  isReady: boolean
  isSlow: boolean
  isWaking: boolean
  error: string | null
  ensureReady: () => Promise<void>
  loadingMessage: string
}

/**
 * Dispara el wake del backend al montar y expone mensaje de carga lenta
 * para cold starts (tiers gratuitos que se apagan por inactividad).
 */
export function useBackendWakeup(options?: {
  enabled?: boolean
}): BackendWakeupState {
  const enabled = options?.enabled ?? true
  const [isReady, setIsReady] = useState(!enabled)
  const [isSlow, setIsSlow] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const ensureReady = useCallback(async () => {
    setError(null)
    await wakeBackend()
    setIsReady(true)
    setIsSlow(false)
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

    void wakeBackend()
      .then(() => {
        if (!cancelled) {
          setIsReady(true)
          setError(null)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(
            'El servicio está tardando en iniciar. Puedes reintentar en un momento.',
          )
          setIsReady(true)
        }
      })
      .finally(() => {
        window.clearTimeout(slowTimer)
      })

    return () => {
      cancelled = true
      window.clearTimeout(slowTimer)
    }
  }, [enabled])

  const isWaking = enabled && !isReady
  const loadingMessage = isSlow
    ? 'Estamos iniciando el servicio, espera un momento...'
    : 'Cargando...'

  return {
    isReady,
    isSlow,
    isWaking,
    error,
    ensureReady,
    loadingMessage,
  }
}
