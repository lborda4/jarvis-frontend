import { beforeEach, expect, it, vi } from 'vitest'
const api = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('./apiClient', () => ({ apiClient: api }))
import { fetchJarvisTypeRejections } from './jarvisService'
import { invalidateQueryCache, setActiveCompanyId } from './queryCache'

beforeEach(() => { vi.resetAllMocks(); invalidateQueryCache(); setActiveCompanyId('company-1') })

it('consulta y cachea los nombres y códigos maestros sin sustituir el código por el ID', async () => {
  const rows = [{ id: 99, name: 'Servicio no prestado', code: '04' }]
  api.get.mockResolvedValue({ data: rows })
  expect(await fetchJarvisTypeRejections()).toEqual(rows)
  expect(await fetchJarvisTypeRejections()).toEqual(rows)
  expect(api.get).toHaveBeenCalledTimes(1)
  expect(api.get).toHaveBeenCalledWith('/integrations/jarvis/catalogs/type-rejections')
})

it('permite reintentar la carga cuando falla la consulta', async () => {
  api.get.mockRejectedValueOnce(new Error('Sin conexión')).mockResolvedValueOnce({ data: [] })
  await expect(fetchJarvisTypeRejections()).rejects.toThrow('Sin conexión')
  await expect(fetchJarvisTypeRejections()).resolves.toEqual([])
  expect(api.get).toHaveBeenCalledTimes(2)
})
