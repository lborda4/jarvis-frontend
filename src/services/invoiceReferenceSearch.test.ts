import { beforeEach, expect, it, vi } from 'vitest'
import { fetchJarvisSalesInvoices } from './jarvisService'
import { invalidateQueryCache, setActiveCompanyId } from './queryCache'
import { apiClient } from './apiClient'

vi.mock('./apiClient', () => ({ apiClient: { get: vi.fn() } }))
beforeEach(() => {
  vi.resetAllMocks(); invalidateQueryCache(); setActiveCompanyId('owner')
  vi.mocked(apiClient.get).mockResolvedValue({ data: { items: [], total: 0, page: 1, pageSize: 20 } })
})

it('consulta desde el primer carácter y separa las respuestas de cada consecutivo', async () => {
  for (const number of ['F', 'FV', 'FV1']) await fetchJarvisSalesInvoices({ number, page: 1 })
  expect(apiClient.get).toHaveBeenCalledTimes(3)
  for (const [index, number] of ['F', 'FV', 'FV1'].entries()) expect(apiClient.get).toHaveBeenNthCalledWith(index + 1, '/integrations/jarvis/invoices', { params: { number, page: 1 } })
  await fetchJarvisSalesInvoices({ number: 'FV', page: 1 })
  expect(apiClient.get).toHaveBeenCalledTimes(3)
})

it('mantiene separadas las búsquedas por empresa y del filtro general del historial', async () => {
  await fetchJarvisSalesInvoices({ number: 'F', page: 1 })
  await fetchJarvisSalesInvoices({ search: 'F', page: 1 })
  setActiveCompanyId('other')
  await fetchJarvisSalesInvoices({ number: 'F', page: 1 })
  expect(apiClient.get).toHaveBeenCalledTimes(3)
})
