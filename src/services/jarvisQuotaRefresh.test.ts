import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from './apiClient'
import { affectsJarvisQuota, observeJarvisQuota } from './jarvisQuotaRefresh'

vi.mock('./apiClient', async () => {
  const { default: axios } = await import('axios')
  return { apiClient: axios.create() }
})

let stop: (() => void) | undefined
beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('window', new EventTarget())
  apiClient.defaults.adapter = async config => ({ config, data: {}, status: 200, statusText: 'OK', headers: {} })
})
afterEach(() => { stop?.(); stop = undefined; vi.useRealTimers(); vi.unstubAllGlobals() })

describe('actualizaciones de cupo', () => {
  it('agrupa envíos cercanos y conserva la actualización forzada frente a eventos de foco', async () => {
    const refresh = vi.fn().mockResolvedValue(undefined)
    stop = observeJarvisQuota(refresh)
    await Promise.all([
      apiClient.post('/integrations/jarvis/invoices'),
      apiClient.post('/integrations/jarvis/payroll/months/2026-12/employees/employee/send'),
      apiClient.post('/integrations/jarvis/radian/events'),
    ])
    window.dispatchEvent(new Event('focus'))
    expect(refresh).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1000)
    expect(refresh).toHaveBeenCalledExactlyOnceWith(true)
    window.dispatchEvent(new Event('focus'))
    await vi.advanceTimersByTimeAsync(1000)
    expect(refresh).toHaveBeenLastCalledWith(false)
  })

  it('no actualiza cupo por guardar empleados, terceros, configuración, borradores o consultar documentos', async () => {
    const refresh = vi.fn().mockResolvedValue(undefined)
    stop = observeJarvisQuota(refresh)
    await Promise.all([
      apiClient.post('/integrations/jarvis/credentials'),
      apiClient.post('/integrations/jarvis/resolutions'),
      apiClient.post('/integrations/jarvis/resolutions/parse'),
      apiClient.post('/integrations/jarvis/terceros/lookup-nit'),
      apiClient.post('/integrations/jarvis/terceros'),
      apiClient.put('/integrations/jarvis/payroll/employees/employee'),
      apiClient.put('/electronic-documents/document/draft'),
      apiClient.post('/integrations/jarvis/invoices/document/send-email'),
      apiClient.post('/integrations/jarvis/payroll/documents/document/status'),
      apiClient.get('/integrations/jarvis/subscription/status'),
    ])
    await vi.advanceTimersByTimeAsync(2000)
    expect(refresh).not.toHaveBeenCalled()
  })

  it('actualiza tras un fallo de envío que puede dejar cupo reservado y propaga el error original', async () => {
    const refresh = vi.fn().mockResolvedValue(undefined)
    stop = observeJarvisQuota(refresh)
    const error = { code: 'ECONNABORTED', config: { method: 'post', url: '/integrations/jarvis/payroll/documents/document/send' } }
    apiClient.defaults.adapter = async () => { throw error }
    await expect(apiClient.post(error.config.url)).rejects.toBe(error)
    await vi.advanceTimersByTimeAsync(1000)
    expect(refresh).toHaveBeenCalledExactlyOnceWith(true)
  })

  it('cancela las actualizaciones pendientes y retira los interceptores al desmontar', async () => {
    const refresh = vi.fn().mockResolvedValue(undefined)
    stop = observeJarvisQuota(refresh)
    await apiClient.post('/integrations/jarvis/invoices')
    stop(); stop = undefined
    window.dispatchEvent(new Event('focus'))
    await apiClient.post('/integrations/jarvis/invoices')
    await vi.advanceTimersByTimeAsync(2000)
    expect(refresh).not.toHaveBeenCalled()
  })

  it.each([
    '/integrations/jarvis/invoices', '/integrations/jarvis/support-documents',
    '/integrations/jarvis/support-documents/manual', '/integrations/jarvis/support-documents/issue',
    '/integrations/jarvis/radian/events', '/integrations/jarvis/documents/prepare', '/integrations/jarvis/documents/resume',
    '/integrations/jarvis/payroll/documents/document/send',
    '/integrations/jarvis/payroll/months/2026-12/employees/employee/send',
  ])('reconoce la emisión por POST en %s', url => {
    expect(affectsJarvisQuota({ method: 'POST', url: `${url}/?source=ui` })).toBe(true)
    expect(affectsJarvisQuota({ method: 'GET', url })).toBe(false)
  })
})
