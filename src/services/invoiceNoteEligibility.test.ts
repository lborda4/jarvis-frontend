import { beforeEach, expect, it, vi } from 'vitest'
import { fetchJarvisInvoiceDetail } from './jarvisService'
import { fetchRadianHistory, type RadianStoredEvent } from './radianService'
import { invoiceNoteBlockReason } from './invoiceNoteEligibility'

vi.mock('./jarvisService', () => ({ fetchJarvisInvoiceDetail: vi.fn() }))
vi.mock('./radianService', () => ({ fetchRadianHistory: vi.fn() }))

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(fetchJarvisInvoiceDetail).mockResolvedValue({ cufe: 'invoice-cufe' } as Awaited<ReturnType<typeof fetchJarvisInvoiceDetail>>)
})

it('bloquea las notas cuando la aceptación RADIAN está confirmada', async () => {
  vi.mocked(fetchRadianHistory).mockResolvedValue([{ eventId: 4, status: 'sent' }])
  expect(await invoiceNoteBlockReason('invoice-1')).toContain('No se le puede hacer nota crédito ni nota débito')
  expect(fetchJarvisInvoiceDetail).toHaveBeenCalledWith('invoice-1')
  expect(fetchRadianHistory).toHaveBeenCalledWith('invoice-cufe')
})

it.each<RadianStoredEvent[][]>([
  [[]],
  [[{ eventId: 1, status: 'sent' }, { eventId: 3, status: 'sent' }]],
  [[{ eventId: 2, status: 'sent' }]],
  [[{ eventId: 4, status: 'failed' }]],
])('permite notas sin aceptación confirmada: %j', async events => {
  vi.mocked(fetchRadianHistory).mockResolvedValue(events)
  expect(await invoiceNoteBlockReason('invoice-1')).toBeNull()
})

it('mantiene el bloqueo si la aceptación aún está por confirmar', async () => {
  vi.mocked(fetchRadianHistory).mockResolvedValue([{ eventId: 4, status: 'unknown' }])
  expect(await invoiceNoteBlockReason('invoice-1')).toContain('por confirmar')
})

it('no interpreta un error de consulta como ausencia de aceptación', async () => {
  vi.mocked(fetchRadianHistory).mockRejectedValue(new Error('Sin conexión'))
  await expect(invoiceNoteBlockReason('invoice-1')).rejects.toThrow('Sin conexión')
})

it('no consulta RADIAN si no tiene el CUFE de la factura', async () => {
  vi.mocked(fetchJarvisInvoiceDetail).mockResolvedValue({ cufe: null } as Awaited<ReturnType<typeof fetchJarvisInvoiceDetail>>)
  await expect(invoiceNoteBlockReason('invoice-1')).rejects.toThrow('CUFE')
  expect(fetchRadianHistory).not.toHaveBeenCalled()
})
