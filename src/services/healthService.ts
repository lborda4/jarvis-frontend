import axios from 'axios'
import { API_BASE_URL } from '../constants/api'

const HEALTH_ENDPOINT = '/health'
const HEALTH_REQUEST_TIMEOUT_MS = 45_000
const HEALTH_RETRY_DELAY_MS = 2_000
const HEALTH_MAX_ATTEMPTS = 8

let wakePromise: Promise<void> | null = null

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

async function pingHealthOnce(): Promise<void> {
  const response = await axios.get<{ status?: string }>(
    `${API_BASE_URL}${HEALTH_ENDPOINT}`,
    {
      timeout: HEALTH_REQUEST_TIMEOUT_MS,
      // Sin Authorization: el cold start no debe depender de sesión.
      validateStatus: (status) => status >= 200 && status < 300,
    },
  )

  if (response.data?.status !== 'ok') {
    throw new Error('Health check inválido')
  }
}

async function pingHealthWithRetries(): Promise<void> {
  let lastError: unknown

  for (let attempt = 1; attempt <= HEALTH_MAX_ATTEMPTS; attempt += 1) {
    try {
      await pingHealthOnce()
      return
    } catch (error) {
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

/** Despierta el backend (cold start). Comparte una sola promesa entre callers. */
export function wakeBackend(): Promise<void> {
  if (!wakePromise) {
    wakePromise = pingHealthWithRetries().catch((error) => {
      wakePromise = null
      throw error
    })
  }

  return wakePromise
}

export function isBackendWakeInFlight(): boolean {
  return wakePromise !== null
}
