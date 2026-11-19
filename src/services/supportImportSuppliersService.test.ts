import { beforeEach, expect, it, vi } from 'vitest'
import { createJarvisTercero, fetchJarvisTerceros } from './jarvisService'
import { createSupportImportSuppliers } from './supportImportSuppliersService'
import { setActiveCompanyId } from './queryCache'
import type { JarvisTercero } from '../types/jarvis'

vi.mock('./jarvisService', () => ({ createJarvisTercero: vi.fn(), fetchJarvisTerceros: vi.fn() }))
const supplier = { document_type: 'NIT', document_number: '900123', name: 'Mi empresa', email: null, municipality_id: 149 }
beforeEach(() => {
  vi.resetAllMocks()
  setActiveCompanyId('company-a')
  vi.mocked(fetchJarvisTerceros).mockResolvedValue({ items: [], total: 0 })
  vi.mocked(createJarvisTercero).mockImplementation(async payload => ({ success: true, tercero: { ...payload, id: payload.document_number } as JarvisTercero }))
})

it('crea cada NIT una sola vez aunque aparezca en varios registros', async () => {
  const result = await createSupportImportSuppliers([supplier, supplier, { ...supplier, document_number: '900456', name: 'Otra empresa' }], 'company-a')
  expect(createJarvisTercero).toHaveBeenCalledTimes(2)
  expect(createJarvisTercero).toHaveBeenCalledWith(expect.objectContaining({ document_number: '900123', name: 'Mi empresa', municipality_id: 149 }))
  expect(result.suppliers).toHaveLength(2)
  expect(result.failures).toEqual([])
})
it('reconsulta los existentes para que un reintento no duplique terceros ya creados', async () => {
  vi.mocked(fetchJarvisTerceros).mockResolvedValue({ items: [{ ...supplier, id: 'existing' } as JarvisTercero], total: 1 })
  const result = await createSupportImportSuppliers([supplier], 'company-a')
  expect(fetchJarvisTerceros).toHaveBeenCalledWith(undefined, { force: true })
  expect(createJarvisTercero).not.toHaveBeenCalled()
  expect(result.suppliers[0].id).toBe('existing')
})
it.each([
  { ...supplier, name: '' }, { ...supplier, email: 'mal-correo' },
  { ...supplier, municipality_id: undefined }, { ...supplier, document_number: 'NIT-invalid' },
])('valida todo el lote antes de crear si hay un dato inválido: %j', async invalid => {
  await expect(createSupportImportSuppliers([supplier, invalid], 'company-a')).rejects.toThrow()
  expect(createJarvisTercero).not.toHaveBeenCalled()
})
it('conserva los terceros creados y reporta cuáles fallaron', async () => {
  vi.mocked(createJarvisTercero).mockRejectedValueOnce(new Error('No se pudo crear'))
  const result = await createSupportImportSuppliers([supplier, { ...supplier, document_number: '900456' }], 'company-a')
  expect(result.suppliers.map(item => item.document_number)).toEqual(['900456'])
  expect(result.failures).toEqual(['900123: No se pudo crear'])
})
it('bloquea la creación si cambia la empresa activa', async () => {
  vi.mocked(fetchJarvisTerceros).mockImplementation(async () => { setActiveCompanyId('company-b'); return { items: [], total: 0 } })
  await expect(createSupportImportSuppliers([supplier], 'company-a')).rejects.toThrow('empresa activa cambió')
  expect(createJarvisTercero).not.toHaveBeenCalled()
})
