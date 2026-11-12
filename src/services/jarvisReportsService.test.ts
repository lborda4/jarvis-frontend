import { beforeEach, expect, it, vi } from 'vitest'
import { apiClient } from './apiClient'
import { exportJarvisReport, fetchJarvisReport, fetchJarvisReportSuggestions, type JarvisReportFilters } from './jarvisReportsService'

vi.mock('./apiClient', () => ({ apiClient: { get: vi.fn() } }))
beforeEach(() => vi.resetAllMocks())
const filters: JarvisReportFilters = { report: 'products', view: 'detail', from: '2026-10-01', to: '2026-10-31', search: 'NC1', customer: 'Cliente', seller: 'Ana', product: 'Servicio', kind: 'CREDIT_NOTE', currency: 'COP', page: 3, pageSize: 20 }

it('carga sugerencias del contexto completo con cancelación al cambiar de empresa', async () => {
  const context = { report: filters.report, from: filters.from, to: filters.to, kind: filters.kind }
  const signal = new AbortController().signal
  const options = { customers: [{ value: '123', label: 'Cliente — 123' }], products: [], sellers: [], search: [] }
  vi.mocked(apiClient.get).mockResolvedValue({ data: options })
  await expect(fetchJarvisReportSuggestions(context, signal)).resolves.toEqual(options)
  expect(apiClient.get).toHaveBeenCalledWith('/integrations/jarvis/reports/suggestions', { params: context, signal, timeout: 120000 })
})

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
  expect(config.params).toMatchObject({ report: 'products', from: filters.from, to: filters.to, search: 'NC1', customer: 'Cliente', seller: 'Ana', product: 'Servicio', kind: 'CREDIT_NOTE', currency: 'COP' })
  expect(config.params).not.toHaveProperty('page')
  expect(config.params).not.toHaveProperty('pageSize')
  expect(config.responseType).toBe('blob')
})

it('conserva el impuesto seleccionado tanto al consultar como al exportar el reporte fiscal', async () => {
  const taxFilters = { ...filters, report: 'taxes' as const, product: '', tax: 'reteIca' }
  vi.mocked(apiClient.get).mockResolvedValue({ data: new Blob(['xlsx']) })
  await fetchJarvisReport(taxFilters)
  await exportJarvisReport(taxFilters)
  for (const [, config] of vi.mocked(apiClient.get).mock.calls) expect(config?.params).toMatchObject({ report: 'taxes', tax: 'reteIca', product: '' })
})
