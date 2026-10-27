import { beforeEach, expect, it, vi } from 'vitest'
import { apiClient } from './apiClient'
import { exportJarvisReport, fetchJarvisReport, type JarvisReportFilters } from './jarvisReportsService'

vi.mock('./apiClient', () => ({ apiClient: { get: vi.fn() } }))
beforeEach(() => vi.resetAllMocks())
const filters: JarvisReportFilters = { report: 'products', view: 'detail', from: '2026-10-01', to: '2026-10-31', customer: 'Cliente', seller: 'Ana', product: 'Servicio', kind: 'CREDIT_NOTE', currency: 'COP', page: 3, pageSize: 20 }

it('envía todos los filtros y permite cancelar una consulta al cambiar de empresa', async () => {
  const signal = new AbortController().signal
  vi.mocked(apiClient.get).mockResolvedValue({ data: { total: 23 } })
  expect(await fetchJarvisReport(filters, signal)).toEqual({ total: 23 })
  expect(apiClient.get).toHaveBeenCalledWith('/integrations/jarvis/reports', { params: filters, signal, timeout: 120000 })
})
it('exporta los filtros vigentes sin limitar los resultados a la página visible', async () => {
  const file = new Blob(['xlsx'])
  vi.mocked(apiClient.get).mockResolvedValue({ data: file })
  expect(await exportJarvisReport(filters)).toBe(file)
  const config = vi.mocked(apiClient.get).mock.calls[0][1]!
  expect(config.params).toMatchObject({ report: 'products', from: filters.from, to: filters.to, customer: 'Cliente', seller: 'Ana', product: 'Servicio', kind: 'CREDIT_NOTE', currency: 'COP' })
  expect(config.params).not.toHaveProperty('page')
  expect(config.params).not.toHaveProperty('pageSize')
  expect(config.responseType).toBe('blob')
})
