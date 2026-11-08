import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as XLSX from 'xlsx'
import { apiClient } from './apiClient'
import { setActiveCompanyId, setCachedQuery, companyQueryKey } from './queryCache'
import { assignSupportDraftIds, MissingSupportSuppliersError, saveImportedSupportDocuments } from './supportDocumentsImportService'
import { createSupportDocumentsTemplate, readSupportDocumentsWorkbook } from '../utils/supportDocumentsExcel'
import type { JarvisTercero } from '../types/jarvis'

vi.mock('./apiClient', () => ({ apiClient: { get: vi.fn(), put: vi.fn(), post: vi.fn() }, getApiErrorMessage: (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback }))
const supplier = { id: 'supplier', document_type: 'NIT', document_number: '900123', name: 'Proveedor' } as JarvisTercero
function rows(references = ['REF-1']) {
  const book = createSupportDocumentsTemplate()
  XLSX.utils.sheet_add_aoa(book.Sheets['Documentos soporte'], references.map(reference => [reference, '2026-11-07', 'NIT', '900123', 'Servicio', '1', '100', 'Efectivo']), { origin: 'A2' })
  return readSupportDocumentsWorkbook(XLSX.write(book, { type: 'array', bookType: 'xlsx' }), { currencies: ['COP'], taxes: [], paymentMethods: [{ id: 'cash', name: 'Efectivo', negotiation: 'CASH', nextpymeMethodId: 10, nextpymeMethodName: 'Efectivo' }] }, [supplier])
}
describe('carga masiva de documentos soporte', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    setActiveCompanyId(null); setActiveCompanyId('company-a')
    vi.mocked(apiClient.get).mockImplementation(async url => ({ data: { items: url === '/integrations/jarvis/terceros' ? [supplier] : [], total: 1 } }))
    vi.mocked(apiClient.put).mockResolvedValue({ data: {} })
  })
  it('guarda documentos editables en la base de datos usando borradores de soporte, sin enviarlos a DIAN', async () => {
    const progress = vi.fn()
    const result = await saveImportedSupportDocuments(rows(), progress)
    expect(result[0].status).toBe('saved')
    expect(apiClient.put).toHaveBeenCalledExactlyOnceWith(`/integrations/jarvis/drafts/${result[0].draftId}`, { documentKind: 'SUPPORT_DOCUMENT', state: expect.objectContaining({ selectedCustomer: expect.objectContaining({ id: 'supplier' }), lines: expect.any(Array), importReference: 'REF-1', documentTotal: 100 }) })
    expect(apiClient.post).not.toHaveBeenCalled()
    expect(progress).toHaveBeenCalledOnce()
  })
  it('reconsulta los NIT y no guarda nada si falta uno, aunque la caché lo tenga', async () => {
    setCachedQuery(companyQueryKey(['jarvis', 'terceros']), { items: [supplier], total: 1 })
    vi.mocked(apiClient.get).mockResolvedValue({ data: { items: [], total: 0 } })
    await expect(saveImportedSupportDocuments(rows(['REF-1', 'REF-2']), vi.fn())).rejects.toBeInstanceOf(MissingSupportSuppliersError)
    expect(apiClient.get).toHaveBeenCalledWith('/integrations/jarvis/terceros')
    expect(apiClient.put).not.toHaveBeenCalled()
    expect(apiClient.post).not.toHaveBeenCalled()
  })
  it('bloquea todo el archivo si un NIT falta entre otros válidos y permite guardar después de crearlo', async () => {
    const input = rows(['REF-1', 'REF-2'])
    input[1].identification = '900999'
    await expect(saveImportedSupportDocuments(input, vi.fn())).rejects.toThrow('Debes crearlos primero')
    expect(apiClient.put).not.toHaveBeenCalled()
    vi.mocked(apiClient.get).mockImplementation(async url => ({ data: { items: url === '/integrations/jarvis/terceros' ? [supplier, { ...supplier, id: 'supplier-2', document_number: '900999' }] : [] } }))
    const result = await saveImportedSupportDocuments(input, vi.fn())
    expect(result.every(row => row.status === 'saved')).toBe(true)
    expect(result[1].state.selectedCustomer?.id).toBe('supplier-2')
  })
  it('crea IDs estables por empresa y referencia para conservar la identidad en reintentos', async () => {
    const first = await assignSupportDraftIds(rows(), 'company-a')
    const same = await assignSupportDraftIds(rows(['ref-1']), 'company-a')
    const other = await assignSupportDraftIds(rows(), 'company-b')
    expect(first[0].draftId).toBe(same[0].draftId)
    expect(first[0].draftId).not.toBe(other[0].draftId)
    expect(first[0].draftId).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-5[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/)
  })
  it('omite referencias ya guardadas sin sobrescribir sus cambios', async () => {
    const input = await assignSupportDraftIds(rows(), 'company-a')
    vi.mocked(apiClient.get).mockImplementation(async url => ({ data: { items: url === '/integrations/jarvis/terceros' ? [supplier] : [{ id: input[0].draftId }] } }))
    expect((await saveImportedSupportDocuments(input, vi.fn()))[0].status).toBe('duplicate')
    expect(apiClient.put).not.toHaveBeenCalled()
  })
  it('conserva resultados parciales y solo reintenta los no guardados', async () => {
    vi.mocked(apiClient.put).mockRejectedValueOnce(new Error('Timeout'))
    const first = await saveImportedSupportDocuments(rows(['REF-1', 'REF-2']), vi.fn())
    expect(first.map(row => row.status)).toEqual(['failed', 'saved'])
    vi.mocked(apiClient.put).mockClear()
    const second = await saveImportedSupportDocuments(first, vi.fn())
    expect(apiClient.put).toHaveBeenCalledTimes(1)
    expect(second.every(row => row.status === 'saved')).toBe(true)
    expect(second[0].draftId).toBe(first[0].draftId)
  })
  it('detecta un guardado cuya respuesta se perdió antes de volver a enviar el PUT', async () => {
    vi.mocked(apiClient.put).mockRejectedValueOnce(new Error('Respuesta perdida'))
    const first = await saveImportedSupportDocuments(rows(), vi.fn())
    vi.mocked(apiClient.get).mockImplementation(async url => ({ data: { items: url === '/integrations/jarvis/terceros' ? [supplier] : [{ id: first[0].draftId }] } }))
    expect((await saveImportedSupportDocuments(first, vi.fn()))[0].status).toBe('duplicate')
    expect(apiClient.put).toHaveBeenCalledTimes(1)
  })
  it('rechaza archivos con errores antes de hacer peticiones de guardado', async () => {
    const input = rows(); input[0].errors = ['Falta descripción']
    await expect(saveImportedSupportDocuments(input, vi.fn())).rejects.toThrow('Corrige')
    expect(apiClient.get).not.toHaveBeenCalled()
    expect(apiClient.put).not.toHaveBeenCalled()
  })
  it('detiene la carga si cambia la empresa activa', async () => {
    vi.mocked(apiClient.get).mockImplementation(async () => {
      setActiveCompanyId('company-b')
      return { data: { items: [supplier] } }
    })
    await expect(saveImportedSupportDocuments(rows(), vi.fn())).rejects.toThrow('empresa activa cambió')
    expect(apiClient.put).not.toHaveBeenCalled()
  })
})
