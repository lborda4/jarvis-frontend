import { apiClient } from './apiClient'

/** Only operations that may consume or reserve the JARVIS document quota. */
export function affectsJarvisQuota(config?: { method?: string; url?: string }): boolean {
  if (config?.method?.toLowerCase() !== 'post') return false
  const path = config.url?.split('?')[0].replace(/\/$/, '') ?? ''
  return /^\/integrations\/jarvis\/(?:invoices|support-documents(?:\/(?:manual|issue))?|radian\/events|documents\/(?:prepare|resume)|payroll\/(?:documents\/[^/]+|months\/[^/]+\/employees\/[^/]+)\/send)$/.test(path)
}

/** Coalesce close completions; focus refreshes reuse fresh quota data. */
export function observeJarvisQuota(refresh: (force: boolean) => Promise<void>): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  let forceRefresh = false
  const schedule = (force: boolean) => {
    forceRefresh ||= force
    clearTimeout(timer)
    timer = setTimeout(() => {
      const force = forceRefresh
      forceRefresh = false
      timer = undefined
      void refresh(force).catch(() => { /* Retain the last confirmed quota. */ })
    }, 1000)
  }
  const focus = () => schedule(false)
  const interceptor = apiClient.interceptors.response.use(
    response => {
      if (affectsJarvisQuota(response.config)) schedule(true)
      return response
    },
    error => {
      // Timeouts and provider failures can leave quota reserved for an uncertain transmission.
      if (affectsJarvisQuota(error.config)) schedule(true)
      return Promise.reject(error)
    },
  )
  window.addEventListener('focus', focus)
  return () => {
    clearTimeout(timer)
    apiClient.interceptors.response.eject(interceptor)
    window.removeEventListener('focus', focus)
  }
}
