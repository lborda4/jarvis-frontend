import { beforeEach, expect, it, vi } from 'vitest'
import { apiClient } from './apiClient'
import { fetchRadianHistory, lookupRadianInvoice, processRadianInvoices, sendRadianEvent, type RadianStatus } from './radianService'
vi.mock('./apiClient', () => ({ apiClient: { post: vi.fn() } }))
beforeEach(() => vi.clearAllMocks())

it('consulta los datos de la factura para un CUFE agregado manualmente', async () => {
  const cufe = 'a'.repeat(96)
  const invoice = { cufe, number: 'FE1', supplier: 'Proveedor', nit: '900001', date: '2026-10-13', valid: true }
  vi.mocked(apiClient.post).mockResolvedValue({ data: invoice })
  expect(await lookupRadianInvoice(cufe)).toEqual(invoice)
  expect(apiClient.post).toHaveBeenCalledWith('/integrations/jarvis/radian/invoice', { cufe }, { timeout: 180000 })
})

it('no agrega datos de otra factura ni respuestas inválidas', async () => {
  vi.mocked(apiClient.post).mockResolvedValue({ data: { cufe: 'b'.repeat(96), valid: true } })
  await expect(lookupRadianInvoice('a'.repeat(96))).rejects.toThrow()
})

it('envía CUFE y evento a la empresa autenticada sin exponer tokens', async () => {
  vi.mocked(apiClient.post).mockResolvedValue({ data: { status: 'sent' } })
  expect(await sendRadianEvent('a'.repeat(96), 1)).toEqual({ status: 'sent' })
  expect(apiClient.post).toHaveBeenCalledWith('/integrations/jarvis/radian/events', { cufe: 'a'.repeat(96), eventId: 1 })
})

it('envía reclamo con su motivo en vez de aceptación para la factura elegida', async () => {
  vi.mocked(apiClient.post).mockResolvedValue({ data: { status: 'sent' } })
  const { get, set } = progress()
  expect(await processRadianInvoices(['invoice-a'], get, set, () => true, () => ({ eventId: 2, typeRejectionId: 1 }))).toEqual({ sent: 1, interrupted: 0 })
  expect(apiClient.post).toHaveBeenLastCalledWith('/integrations/jarvis/radian/events', { cufe: 'invoice-a', eventId: 2, typeRejectionId: 1 })
  expect(apiClient.post).not.toHaveBeenCalledWith(expect.anything(), { cufe: 'invoice-a', eventId: 4 })
})

it('no envía ningún evento si se eligió reclamo sin motivo', async () => {
  const { get, set } = progress()
  expect(await processRadianInvoices(['invoice-a'], get, set, () => true, () => ({ eventId: 2 }))).toEqual({ sent: 0, interrupted: 1 })
  expect(apiClient.post).not.toHaveBeenCalled()
})

it('respeta distintas decisiones dentro del mismo envío masivo', async () => {
  vi.mocked(apiClient.post).mockResolvedValue({ data: { status: 'sent' } })
  const { get, set } = progress()
  await processRadianInvoices(['invoice-a', 'invoice-b'], get, set, () => true, cufe => cufe === 'invoice-a' ? { eventId: 2, typeRejectionId: 1 } : { eventId: 4 })
  expect(apiClient.post).toHaveBeenCalledWith('/integrations/jarvis/radian/events', { cufe: 'invoice-a', eventId: 2, typeRejectionId: 1 })
  expect(apiClient.post).toHaveBeenCalledWith('/integrations/jarvis/radian/events', { cufe: 'invoice-b', eventId: 4 })
})

it('impide alternar a reclamo cuando la aceptación está confirmada', async () => {
  const { get, set } = progress()
  set('invoice-a', 4, 'sent')
  await processRadianInvoices(['invoice-a'], get, set, () => true, () => ({ eventId: 2, typeRejectionId: 1 }))
  expect(apiClient.post).not.toHaveBeenCalled()
})

it('no confirma un envío cuando la respuesta no trae un estado válido', async () => {
  vi.mocked(apiClient.post).mockResolvedValue({ data: { success: true } })
  expect(await sendRadianEvent('a'.repeat(96), 4)).toEqual({ status: 'unknown' })
})

function progress() {
  const states: Record<string, Partial<Record<number, RadianStatus>>> = {}
  const get = (cufe: string, id: number) => states[cufe]?.[id]
  const set = (cufe: string, id: number, state: RadianStatus) => { states[cufe] = { ...states[cufe], [id]: state } }
  return { get, set }
}

it('envía acuse, recepción y aceptación en orden para cada factura seleccionada', async () => {
  vi.mocked(apiClient.post).mockResolvedValue({ data: { status: 'sent' } })
  const { get, set } = progress()
  expect(await processRadianInvoices(['invoice-a', 'invoice-b', 'invoice-a'], get, set, () => true)).toEqual({ sent: 2, interrupted: 0 })
  expect(vi.mocked(apiClient.post).mock.calls.map(([, request]) => request)).toEqual([
    { cufe: 'invoice-a', eventId: 1 }, { cufe: 'invoice-a', eventId: 3 }, { cufe: 'invoice-a', eventId: 4 },
    { cufe: 'invoice-b', eventId: 1 }, { cufe: 'invoice-b', eventId: 3 }, { cufe: 'invoice-b', eventId: 4 },
  ])
})

it('no envía aceptación si falla la recepción y continúa con otras facturas', async () => {
  vi.mocked(apiClient.post).mockResolvedValue({ data: { status: 'sent' } }).mockResolvedValueOnce({ data: { status: 'sent' } }).mockResolvedValueOnce({ data: { status: 'failed' } })
  const { get, set } = progress()
  expect(await processRadianInvoices(['invoice-a', 'invoice-b'], get, set, () => true)).toEqual({ sent: 1, interrupted: 1 })
  expect(vi.mocked(apiClient.post).mock.calls.map(([, request]) => request)).not.toContainEqual({ cufe: 'invoice-a', eventId: 4 })
})

it('reanuda un envío parcial sin repetir los eventos confirmados', async () => {
  vi.mocked(apiClient.post).mockResolvedValue({ data: { status: 'sent' } })
  const { get, set } = progress()
  set('invoice-a', 1, 'sent')
  await processRadianInvoices(['invoice-a'], get, set, () => true)
  expect(apiClient.post).toHaveBeenCalledTimes(2)
  expect(apiClient.post).not.toHaveBeenCalledWith(expect.anything(), { cufe: 'invoice-a', eventId: 1 })
})

it('marca por confirmar una interrupción de red y no la reenvía automáticamente', async () => {
  vi.mocked(apiClient.post).mockRejectedValue(new Error('timeout'))
  const { get, set } = progress()
  await processRadianInvoices(['invoice-a'], get, set, () => true)
  expect(get('invoice-a', 1)).toBe('unknown')
  await processRadianInvoices(['invoice-a'], get, set, () => true)
  expect(apiClient.post).toHaveBeenCalledTimes(1)
})

it('detiene los eventos restantes al abandonar la pantalla o cambiar de empresa', async () => {
  const { get, set } = progress()
  let active = true
  vi.mocked(apiClient.post).mockImplementation(async () => { active = false; return { data: { status: 'sent' } } })
  await processRadianInvoices(['invoice-a', 'invoice-b'], get, set, () => active)
  expect(apiClient.post).toHaveBeenCalledTimes(1)
})

it('recupera CUDE y mensajes persistentes sin volver a emitir eventos', async () => {
  const events = [{ eventId: 1, status: 'sent', cude: 'event-cude', message: 'Autorizado' }]
  vi.mocked(apiClient.post).mockResolvedValue({ data: { events } })
  expect(await fetchRadianHistory('invoice-cufe')).toEqual(events)
  expect(apiClient.post).toHaveBeenCalledWith('/integrations/jarvis/radian/invoices/invoice-cufe/events/reconcile', {})
  expect(apiClient.post).not.toHaveBeenCalledWith('/integrations/jarvis/radian/events', expect.anything())
})
it('no reemplaza estados con un historial inválido', async () => {
  vi.mocked(apiClient.post).mockResolvedValue({ data: {} })
  await expect(fetchRadianHistory('invoice-cufe')).rejects.toThrow('historial RADIAN')
})

it('retoma la recepción fallida y sigue con aceptación sin repetir el acuse', async () => {
  const { get, set } = progress()
  set('invoice-a', 1, 'sent'); set('invoice-a', 3, 'failed')
  vi.mocked(apiClient.post).mockResolvedValue({ data: { status: 'sent' } })
  expect(await processRadianInvoices(['invoice-a'], get, set, () => true)).toEqual({ sent: 1, interrupted: 0 })
  expect(apiClient.post).toHaveBeenCalledTimes(2)
  expect(apiClient.post).toHaveBeenNthCalledWith(1, '/integrations/jarvis/radian/events', { cufe: 'invoice-a', eventId: 3 })
  expect(apiClient.post).toHaveBeenNthCalledWith(2, '/integrations/jarvis/radian/events', { cufe: 'invoice-a', eventId: 4 })
})
it('no continúa con aceptación si la recepción vuelve a fallar', async () => {
  const { get, set } = progress()
  set('invoice-a', 1, 'sent'); set('invoice-a', 3, 'failed')
  vi.mocked(apiClient.post).mockResolvedValue({ data: { status: 'failed' } })
  expect(await processRadianInvoices(['invoice-a'], get, set, () => true)).toEqual({ sent: 0, interrupted: 1 })
  expect(apiClient.post).toHaveBeenCalledTimes(1)
})
