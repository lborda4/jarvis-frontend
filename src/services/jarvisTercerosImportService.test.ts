import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TerceroImportRow } from '../utils/jarvisTercerosExcel'
import { apiClient } from './apiClient'
import { companyQueryKey, setActiveCompanyId, setCachedQuery } from './queryCache'
import { saveImportedTerceros } from './jarvisTercerosImportService'

vi.mock('./apiClient', () => ({ apiClient: { get: vi.fn(), post: vi.fn() }, getApiErrorMessage: (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback }))

function row(number: string, status: TerceroImportRow['status'] = 'ready'): TerceroImportRow {
  return { row: Number(number) + 1, documentType: 'CC', documentNumber: number, name: `Persona ${number}`, errors: [], status, payload: { document_type: 'CC', document_number: number, name: `Persona ${number}`, email: 'persona@example.com', copy_emails: ['cc@example.com'], municipality_id: 149, type_regime_id: 2, tax_responsibility: 'R-99-PN', entity_type: 'natural_person', phone: '123456', address: 'Calle 1' } }
}

describe('guardado masivo de terceros en Jarvis', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    setActiveCompanyId(null)
    setActiveCompanyId('company-a')
    vi.mocked(apiClient.get).mockResolvedValue({ data: { items: [], total: 0 } })
    vi.mocked(apiClient.post).mockImplementation(async (_url, payload) => ({ data: { success: true, tercero: { ...(payload as object), id: 'saved' } } }))
  })

  it('guarda todos los campos mediante el endpoint real de creación, sin requerir documentos pendientes', async () => {
    const input = row('1')
    const progress = vi.fn()
    const result = await saveImportedTerceros([input], progress)
    expect(apiClient.post).toHaveBeenCalledExactlyOnceWith('/integrations/jarvis/terceros', input.payload)
    expect(result[0].status).toBe('saved')
    expect(progress).toHaveBeenCalledWith(expect.objectContaining({ status: 'saved' }))
    expect(input.status).toBe('ready')
  })

  it('consulta duplicados en el servidor aunque haya un catálogo antiguo en caché', async () => {
    setCachedQuery(companyQueryKey(['jarvis', 'terceros']), { items: [], total: 0 })
    vi.mocked(apiClient.get).mockResolvedValue({ data: { items: [{ document_type: 'CC', document_number: '1' }], total: 1 } })
    const result = await saveImportedTerceros([row('1')], vi.fn())
    expect(apiClient.get).toHaveBeenCalledExactlyOnceWith('/integrations/jarvis/terceros')
    expect(apiClient.post).not.toHaveBeenCalled()
    expect(result[0].status).toBe('duplicate')
  })

  it('no guarda ninguna fila si el Excel tiene errores de validación', async () => {
    await expect(saveImportedTerceros([row('1'), { ...row('2'), errors: ['Nombre obligatorio'], status: 'invalid' }], vi.fn())).rejects.toThrow('Corrige')
    expect(apiClient.get).not.toHaveBeenCalled()
    expect(apiClient.post).not.toHaveBeenCalled()
  })

  it('continúa ante fallos parciales y reintenta solamente las filas no guardadas', async () => {
    vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('Sin conexión'))
    const first = await saveImportedTerceros([row('1'), row('2')], vi.fn())
    expect(first.map(row => row.status)).toEqual(['failed', 'saved'])
    expect(first[0].message).toBe('Sin conexión')
    vi.mocked(apiClient.post).mockClear()
    const second = await saveImportedTerceros(first, vi.fn())
    expect(apiClient.post).toHaveBeenCalledExactlyOnceWith('/integrations/jarvis/terceros', first[0].payload)
    expect(second.map(row => row.status)).toEqual(['saved', 'saved'])
  })

  it('comprueba el servidor antes de reintentar una respuesta perdida para evitar guardar dos veces', async () => {
    vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('Timeout'))
    const first = await saveImportedTerceros([row('1')], vi.fn())
    vi.mocked(apiClient.get).mockResolvedValue({ data: { items: [{ document_type: 'CC', document_number: '1' }], total: 1 } })
    const second = await saveImportedTerceros(first, vi.fn())
    expect(second[0].status).toBe('duplicate')
    expect(apiClient.post).toHaveBeenCalledTimes(1)
  })

  it('limita las peticiones simultáneas y entrega un resultado por cada fila', async () => {
    let active = 0
    let peak = 0
    vi.mocked(apiClient.post).mockImplementation(async () => {
      active++
      peak = Math.max(peak, active)
      await new Promise(resolve => setTimeout(resolve, 0))
      active--
      return { data: { success: true, tercero: { id: 'saved' } } }
    })
    const progress = vi.fn()
    const result = await saveImportedTerceros(Array.from({ length: 8 }, (_, i) => row(String(i + 1))), progress)
    expect(peak).toBe(3)
    expect(progress).toHaveBeenCalledTimes(8)
    expect(result.every(row => row.status === 'saved')).toBe(true)
  })

  it('no marca como guardadas respuestas sin confirmación del servidor', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { success: false } })
    expect((await saveImportedTerceros([row('1')], vi.fn()))[0].status).toBe('failed')
  })

  it('no envía filas si cambia la empresa al comprobar duplicados', async () => {
    vi.mocked(apiClient.get).mockImplementation(async () => {
      setActiveCompanyId('company-b')
      return { data: { items: [], total: 0 } }
    })
    await expect(saveImportedTerceros([row('1')], vi.fn())).rejects.toThrow('empresa activa cambió')
    expect(apiClient.post).not.toHaveBeenCalled()
  })

  it('detiene nuevos guardados si cambia la empresa durante la carga', async () => {
    vi.mocked(apiClient.post).mockImplementation(async () => {
      setActiveCompanyId('company-b')
      return { data: { success: true, tercero: { id: 'saved' } } }
    })
    const result = await saveImportedTerceros([row('1'), row('2'), row('3'), row('4')], vi.fn())
    expect(apiClient.post).toHaveBeenCalledTimes(1)
    expect(result.filter(row => row.status === 'failed')).toHaveLength(3)
  })
})
