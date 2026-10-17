import { beforeEach, expect, it, vi } from 'vitest'
import { apiClient } from './apiClient'
import { fetchSavedRadianInvoices, fetchRadianHistory, recoverRadianHistory, lookupRadianInvoice, processRadianInvoices, sendRadianEvent, type RadianStatus } from './radianService'
vi.mock('./apiClient', () => ({ apiClient: { post: vi.fn(), get: vi.fn() } }))
beforeEach(() => vi.clearAllMocks())

it('vuelve a verificar en cada reintento aunque las consultas anteriores fallen', async () => {
  const pending = { eventId: 1, status: 'unknown', cude: 'acuse' }
  vi.mocked(apiClient.get).mockResolvedValue({ data: { events: [pending] } })
  vi.mocked(apiClient.post)
    .mockRejectedValueOnce(new Error('Sin conexión'))
    .mockResolvedValueOnce({ data: { status: 'unknown', cude: 'acuse' } })
    .mockResolvedValueOnce({ data: { status: 'sent', cude: 'acuse' } })
  await expect(recoverRadianHistory('invoice-a')).rejects.toThrow('Sin conexión')
  expect((await recoverRadianHistory('invoice-a'))[0].status).toBe('unknown')
  expect((await recoverRadianHistory('invoice-a'))[0].status).toBe('sent')
  expect(apiClient.get).toHaveBeenCalledTimes(3)
  expect(apiClient.post).toHaveBeenCalledTimes(3)
})

it('recupera el intento pendiente y conserva los eventos confirmados', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({ data: { events: [
    { eventId: 1, status: 'sent', cude: 'acuse' },
    { eventId: 3, status: 'unknown', cude: 'recepcion' },
  ] } })
  vi.mocked(apiClient.post).mockResolvedValue({ data: { status: 'sent', cude: 'recepcion' } })
  expect(await recoverRadianHistory('invoice-cufe')).toEqual([
    { eventId: 1, status: 'sent', cude: 'acuse' },
    { eventId: 3, status: 'sent', cude: 'recepcion' },
  ])
  expect(apiClient.post).toHaveBeenCalledTimes(1)
  expect(apiClient.post).toHaveBeenCalledWith('/integrations/jarvis/radian/events', { cufe: 'invoice-cufe', eventId: 3 })
})

it('recupera un bloqueo local sin inventar eventos que no están guardados', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({ data: { events: [] } })
  expect(await recoverRadianHistory('invoice-cufe')).toEqual([])
  expect(apiClient.post).not.toHaveBeenCalled()
})

it('conserva el estado pendiente cuando el proveedor aún no confirma', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({ data: { events: [{ eventId: 1, status: 'unknown' }] } })
  vi.mocked(apiClient.post).mockResolvedValue({ data: { status: 'unknown', message: 'Pendiente de confirmación' } })
  expect(await recoverRadianHistory('invoice-cufe')).toEqual([{ eventId: 1, status: 'unknown', message: 'Pendiente de confirmación' }])
})

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

it('verifica un reintento y no vuelve a enviar los eventos ya confirmados', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({ data: { events: [1, 3, 4].map(eventId => ({ eventId, status: 'sent' })) } })
  const { get, set } = progress()
  for (const event of await recoverRadianHistory('invoice-a')) set('invoice-a', event.eventId, event.status)
  await processRadianInvoices(['invoice-a'], get, set, () => true)
  expect(apiClient.post).not.toHaveBeenCalled()
})

it('verifica el rechazo y envia los pendientes dentro del mismo reintento', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({ data: { events: [
    { eventId: 1, status: 'unknown', cude: 'acuse' },
  ] } })
  vi.mocked(apiClient.post)
    .mockResolvedValueOnce({ data: { status: 'failed', cude: 'acuse' } })
    .mockResolvedValue({ data: { status: 'sent' } })
  const { get, set } = progress()
  for (const event of await recoverRadianHistory('invoice-a')) set('invoice-a', event.eventId, event.status)
  expect(await processRadianInvoices(['invoice-a'], get, set, () => true)).toEqual({ sent: 1, interrupted: 0 })
  expect(apiClient.post).toHaveBeenCalledTimes(4)
  expect(get('invoice-a', 4)).toBe('sent')
})

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
  vi.mocked(apiClient.get).mockResolvedValue({ data: { events } })
  expect(await fetchRadianHistory('invoice-cufe')).toEqual(events)
  expect(apiClient.get).toHaveBeenCalledWith('/integrations/jarvis/radian/invoices/invoice-cufe/events')
  expect(apiClient.post).not.toHaveBeenCalled()
  expect(apiClient.post).not.toHaveBeenCalledWith('/integrations/jarvis/radian/events', expect.anything())
})
it('no reemplaza estados con un historial inválido', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({ data: {} })
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

it('recupera la lista del servidor por páginas aunque no exista caché local', async () => {
  vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { items: [{ cufe: 'a', events: [{ eventId: 1, status: 'sent', cude: 'event-cude' }] }], nextCursor: 'a' } }).mockResolvedValueOnce({ data: { items: [{ cufe: 'b', events: [] }], nextCursor: null } })
  const result = await fetchSavedRadianInvoices()
  expect(result.map(row => row.cufe)).toEqual(['a', 'b'])
  expect(apiClient.get).toHaveBeenNthCalledWith(2, '/integrations/jarvis/radian/invoices', { params: { cursor: 'a' } })
})
