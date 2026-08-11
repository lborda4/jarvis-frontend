import axios, {
  type AxiosError,
  type InternalAxiosRequestConfig,
} from 'axios'
import { API_BASE_URL } from '../constants/api'
import { extractAuthTokens } from '../utils/authTokens'
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  notifySessionExpired,
  setTokens,
} from './authStorage'
import { isAuthRequestUrl } from '../constants/authEndpoints'

export { API_BASE_URL }

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
})

interface RetriableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean
}

let refreshPromise: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken()

  if (!refreshToken) {
    clearTokens()
    return null
  }

  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${API_BASE_URL}/auth/refresh`, { refreshToken })
      .then((response) => {
        const tokens = extractAuthTokens(response.data)

        if (!tokens) {
          clearTokens()
          return null
        }

        setTokens(tokens)
        return tokens.accessToken
      })
      .catch(() => {
        clearTokens()
        notifySessionExpired()
        return null
      })
      .finally(() => {
        refreshPromise = null
      })
  }

  return refreshPromise
}

apiClient.interceptors.request.use((config) => {
  const requestUrl = config.url ?? ''

  if (isAuthRequestUrl(requestUrl)) {
    return config
  }

  const accessToken = getAccessToken()

  if (accessToken) {
    config.headers.set('Authorization', `Bearer ${accessToken}`)
  }

  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetriableRequestConfig | undefined

    if (
      !originalRequest ||
      error.response?.status !== 401 ||
      originalRequest._retry ||
      isAuthRequestUrl(originalRequest.url)
    ) {
      return Promise.reject(error)
    }

    originalRequest._retry = true

    const newAccessToken = await refreshAccessToken()

    if (!newAccessToken) {
      notifySessionExpired()
      return Promise.reject(error)
    }

    originalRequest.headers.set('Authorization', `Bearer ${newAccessToken}`)
    return apiClient(originalRequest)
  },
)

export function getApiErrorMessage(
  error: unknown,
  fallbackMessage: string,
): string {
  const sanitize = (message: string) =>
    message
      .replace(/NEXTPYME_API_TOKEN/gi, 'el token de integración')
      .replace(/\s*(?:en|a|de|hacia|vía|via)\s+Next\s*Pyme\b/gi, '')
      .replace(/\bNext\s*Pyme\b/gi, '')
      .replace(/\s{2,}/g, ' ')
      .replace(/\s+([.,;:])/g, '$1')
      .replace(/\.\s*\./g, '.')
      .trim()

  if (axios.isAxiosError(error)) {
    const data = error.response?.data

    if (typeof data === 'object' && data !== null && 'message' in data) {
      const message = data.message
      if (typeof message === 'string') return sanitize(message) || fallbackMessage
      if (Array.isArray(message)) {
        const joined = message
          .filter((item): item is string => typeof item === 'string')
          .join(', ')
        return sanitize(joined) || fallbackMessage
      }
    }

    if (typeof data === 'string' && data.length > 0) {
      return sanitize(data) || fallbackMessage
    }

    if (error.response?.status) {
      return `Error del servidor (${error.response.status}). Intenta nuevamente.`
    }

    if (error.code === 'ERR_NETWORK') {
      return 'No se pudo conectar con el servidor. Verifica que el backend esté en ejecución.'
    }

    return sanitize(error.message) || fallbackMessage
  }

  if (error instanceof Error) {
    return sanitize(error.message) || fallbackMessage
  }

  return fallbackMessage
}

export function requireDocumentId(
  documentId: string | null | undefined,
): string {
  const normalizedDocumentId = documentId?.trim()

  if (!normalizedDocumentId) {
    throw new Error(
      'No se encontró el documentId. Vuelva a cargar el archivo XML.',
    )
  }

  return normalizedDocumentId
}
