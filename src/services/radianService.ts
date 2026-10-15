import { apiClient } from './apiClient'
import type { RadianInvoice } from '../utils/radianExcel'

export async function lookupRadianInvoice(cufe: string): Promise<RadianInvoice> {
  const { data } = await apiClient.post<RadianInvoice>('/integrations/jarvis/radian/invoice', { cufe }, { timeout: 180000 })
  if (!data || data.cufe !== cufe || !data.valid) throw new Error('No se pudo consultar la factura.')
  return data
}

export type RadianEventId = 1 | 2 | 3 | 4
export interface RadianDecision { eventId: 2 | 4; typeRejectionId?: number }
export interface RadianProgress { current: number; total: number; cufe: string; eventId?: RadianEventId }
export type RadianStatus = 'sent' | 'failed' | 'unknown' | 'sending'
export interface RadianEventResult { status: 'sent' | 'failed' | 'unknown'; cude?: string; dianCode?: string; message?: string }
export interface RadianStoredEvent extends RadianEventResult { eventId: RadianEventId; typeRejectionId?: number | null; updatedAt?: string }
export async function fetchRadianHistory(cufe: string): Promise<RadianStoredEvent[]> {
  const { data } = await apiClient.post<{ events: RadianStoredEvent[] }>(`/integrations/jarvis/radian/invoices/${encodeURIComponent(cufe)}/events/reconcile`, {})
  if (!Array.isArray(data?.events)) throw new Error('No se pudo consultar el historial RADIAN.')
  return data.events
}
export const RADIAN_EVENTS = [
  { id: 1, code: '030', label: 'Acuse' },
  { id: 3, code: '032', label: 'Recepción' },
  { id: 4, code: '033', label: 'Aceptación' },
] as const

export async function sendRadianEvent(cufe: string, eventId: RadianEventId, typeRejectionId?: number): Promise<RadianEventResult> {
  const { data } = await apiClient.post<RadianEventResult>('/integrations/jarvis/radian/events', { cufe, eventId, ...(eventId === 2 ? { typeRejectionId } : {}) })
  if (!['sent', 'failed', 'unknown'].includes(data?.status)) return { status: 'unknown' }
  return data
}

export async function processRadianInvoices(
  cufes: string[],
  getStatus: (cufe: string, eventId: RadianEventId) => RadianStatus | undefined,
  onResult: (cufe: string, eventId: RadianEventId, status: RadianStatus) => void,
  shouldContinue: () => boolean,
  getDecision: (cufe: string) => RadianDecision = () => ({ eventId: 4 }),
  onProgress?: (progress: RadianProgress) => void,
): Promise<{ sent: number; interrupted: number }> {
  let sent = 0; let interrupted = 0
  const uniqueCufes = [...new Set(cufes)]
  for (const [index, cufe] of uniqueCufes.entries()) {
    if (!shouldContinue()) break
    onProgress?.({ current: index + 1, total: uniqueCufes.length, cufe })
    const decision = getDecision(cufe)
    if (decision.eventId === 2 && (!Number.isInteger(decision.typeRejectionId) || (decision.typeRejectionId ?? 0) <= 0)) { interrupted++; continue }
    const events = [1, 3, decision.eventId] as RadianEventId[]
    if ([1, 2, 3, 4].some(id => ['unknown', 'sending'].includes(getStatus(cufe, id as RadianEventId) ?? ''))) { interrupted++; continue }
    if (getStatus(cufe, decision.eventId === 2 ? 4 : 2) === 'sent') { interrupted++; continue }
    for (const eventId of events) {
      if (!shouldContinue()) break
      if (getStatus(cufe, eventId) === 'sent') continue
      onProgress?.({ current: index + 1, total: uniqueCufes.length, cufe, eventId })
      onResult(cufe, eventId, 'sending')
      let status: RadianStatus = 'unknown'
      try { status = (await sendRadianEvent(cufe, eventId, decision.typeRejectionId)).status } catch { /* A failed connection does not prove the event was not delivered. */ }
      onResult(cufe, eventId, status)
      if (status !== 'sent') { interrupted++; break }
    }
    if (events.every(eventId => getStatus(cufe, eventId) === 'sent')) sent++
  }
  return { sent, interrupted }
}

export interface RadianSavedInvoice extends RadianInvoice { events: RadianStoredEvent[] }
export async function fetchSavedRadianInvoices(): Promise<RadianSavedInvoice[]> {
  const items: RadianSavedInvoice[] = []
  let cursor: string | null = null
  const seen = new Set<string>()
  do {
    const { data }: { data: { items: RadianSavedInvoice[]; nextCursor: string | null } } = await apiClient.get('/integrations/jarvis/radian/invoices', { params: cursor ? { cursor } : {} })
    if (!Array.isArray(data?.items)) throw new Error('No se pudo recuperar el listado RADIAN.')
    items.push(...data.items)
    cursor = data.nextCursor || null
    if (cursor && seen.has(cursor)) throw new Error('El listado RADIAN devolvió una página repetida.')
    if (cursor) seen.add(cursor)
  } while (cursor)
  return items
}