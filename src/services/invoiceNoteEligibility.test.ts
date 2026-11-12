import { beforeEach, expect, it, vi } from 'vitest'
import { fetchJarvisInvoiceDetail } from './jarvisService'
import { apiClient } from './apiClient'
import { invoiceNoteBlockReason, invoiceNoteBlockReasonByCufe } from './invoiceNoteEligibility'

vi.mock('./jarvisService', () => ({ fetchJarvisInvoiceDetail: vi.fn() }))
vi.mock('./apiClient', () => ({ apiClient: { post: vi.fn() } }))

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(fetchJarvisInvoiceDetail).mockResolvedValue({ cufe: 'invoice-cufe' } as Awaited<ReturnType<typeof fetchJarvisInvoiceDetail>>)
})

it('bloquea con la aceptación consultada en NextPyme usando el CUFE de la factura', async () => {
  const blockReason = 'Esta factura ya tiene aceptación en RADIAN. No se le puede hacer nota crédito ni nota débito.'
  vi.mocked(apiClient.post).mockResolvedValue({ data: { source: 'nextpyme', allowed: false, blockReason } })
  expect(await invoiceNoteBlockReason('invoice-1')).toBe(blockReason)
  expect(fetchJarvisInvoiceDetail).toHaveBeenCalledWith('invoice-1')
  expect(apiClient.post).toHaveBeenCalledWith('/integrations/jarvis/radian/note-eligibility', { cufe: 'invoice-cufe' })
})

it('permite continuar solo si NextPyme confirma que no tiene aceptación', async () => {
  vi.mocked(apiClient.post).mockResolvedValue({ data: { source: 'nextpyme', allowed: true, blockReason: null } })
  expect(await invoiceNoteBlockReasonByCufe('manual-cufe')).toBeNull()
  expect(fetchJarvisInvoiceDetail).not.toHaveBeenCalled()
  expect(apiClient.post).toHaveBeenCalledWith('/integrations/jarvis/radian/note-eligibility', { cufe: 'manual-cufe' })
})

it.each([null, {}, { allowed: true }, { source: 'jarvis', allowed: true, blockReason: null }, { source: 'nextpyme', allowed: false, blockReason: null }])('no permite respuestas ambiguas o del historial local: %j', data => {
  vi.mocked(apiClient.post).mockResolvedValue({ data })
  return expect(invoiceNoteBlockReasonByCufe('cufe')).rejects.toThrow('NextPyme')
})

it('no interpreta un error de consulta como ausencia de aceptación', async () => {
  vi.mocked(apiClient.post).mockRejectedValue(new Error('Sin conexión'))
  await expect(invoiceNoteBlockReason('invoice-1')).rejects.toThrow('Sin conexión')
})

it('no consulta RADIAN si la factura no tiene CUFE', async () => {
  vi.mocked(fetchJarvisInvoiceDetail).mockResolvedValue({ cufe: null } as Awaited<ReturnType<typeof fetchJarvisInvoiceDetail>>)
  await expect(invoiceNoteBlockReason('invoice-1')).rejects.toThrow('CUFE')
  expect(apiClient.post).not.toHaveBeenCalled()
})
