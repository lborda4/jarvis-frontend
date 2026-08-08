import axios from 'axios'
import { API_BASE_URL } from '../constants/api'

const HEALTH_ENDPOINT = '/health'
/** Timeout por intento: Render free suele despertar en 15–50s; reintentos cortos detectan antes. */
const HEALTH_REQUEST_TIMEOUT_MS = 20_000
const HEALTH_RETRY_DELAY_MS = 1_500
const HEALTH_MAX_ATTEMPTS = 12

let wakePromise: Promise<void> | null = null
let wakeGeneration = 0

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

async function pingHealthOnce(signal?: AbortSignal): Promise<void> {
  const response = await axios.get<{ status?: string }>(
    `${API_BASE_URL}${HEALTH_ENDPOINT}`,
    {
      timeout: HEALTH_REQUEST_TIMEOUT_MS,
      signal,
      validateStatus: (status) => status >= 200 && status < 300,
    },
  )

  if (response.data?.status !== 'ok') {
    throw new Error('Health check inválido')
  }
}

async function pingHealthWithRetries(signal?: AbortSignal): Promise<void> {
  let lastError: unknown

  for (let attempt = 1; attempt <= HEALTH_MAX_ATTEMPTS; attempt += 1) {
    if (signal?.aborted) {
      throw new DOMException('Wake cancelado', 'AbortError')
    }

    try {
      await pingHealthOnce(signal)
      return
    } catch (error) {
      if (
        axios.isCancel(error) ||
        (typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          (error as { code?: string }).code === 'ERR_CANCELED') ||
        (error instanceof DOMException && error.name === 'AbortError')
      ) {
        throw error
      }

      lastError = error

      if (attempt < HEALTH_MAX_ATTEMPTS) {
        await wait(HEALTH_RETRY_DELAY_MS)
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('No se pudo iniciar el servicio')
}

/** Descarta el wake en curso para forzar un nuevo ciclo de health. */
export function resetBackendWake(): void {
  wakeGeneration += 1
  wakePromise = null
}

/**
 * Despierta el backend (cold start). Comparte una sola promesa entre callers.
 * Con `force: true` cancela el ciclo actual y empieza de nuevo.
 */
export function wakeBackend(options?: { force?: boolean }): Promise<void> {
  if (options?.force) {
    resetBackendWake()
  }

  if (!wakePromise) {
    const generation = wakeGeneration
    const controller = new AbortController()

    wakePromise = pingHealthWithRetries(controller.signal)
      .then(() => {
        if (generation !== wakeGeneration) {
          throw new DOMException('Wake reemplazado', 'AbortError')
        }
      })
      .catch((error) => {
        if (generation === wakeGeneration) {
          wakePromise = null
        }
        throw error
      })
  }

  return wakePromise
}

export function isBackendWakeInFlight(): boolean {
  return wakePromise !== null
}
