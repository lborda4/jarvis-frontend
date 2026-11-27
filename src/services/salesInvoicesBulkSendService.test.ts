import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import * as XLSX from 'xlsx'
import { apiClient } from './apiClient'
import { setActiveCompanyId } from './queryCache'
import { sendImportedSupportDocuments } from './supportDocumentsBulkSendService'
import { LEGACY_SALES_INVOICE_EXCEL_COLUMNS, readSalesInvoicesWorkbook } from '../utils/salesInvoicesExcel'
import type { JarvisTercero } from '../types/jarvis'
import type { InvoiceDraftState } from '../types/invoiceDraft'
import { claimSalesImportDraft, completeSalesImportDraft } from './invoiceDraftService'

vi.mock('./apiClient', () => ({ apiClient: { get: vi.fn(), put: vi.fn(), post: vi.fn() }, getApiErrorMessage: (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback }))
vi.mock('./invoiceDraftService', async importOriginal => ({ ...await importOriginal<typeof import('./invoiceDraftService')>(), claimSalesImportDraft: vi.fn(), completeSalesImportDraft: vi.fn() }))
const customer = { id: 'customer', document_type: 'NIT', document_number: '900123', name: 'Mi cliente' } as JarvisTercero
const catalogs = { products: [], currencies: ['COP'], taxes: [], sellers: [{ id: 'seller', name: 'Ana' }], paymentMethods: [{ id: 'cash', name: 'Efectivo', negotiation: 'CASH' as const, nextpymeMethodId: 10, nextpymeMethodName: 'Efectivo' }] }
type StoredState = InvoiceDraftState & { importSource?: string; importReference?: string }
const stored = new Map<string, { documentKind: string; state: StoredState }>()
const rows = (references = ['VENTA-A']) => {
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([[...LEGACY_SALES_INVOICE_EXCEL_COLUMNS],
    ...references.map(reference => [reference, '2026-11-19', 'NIT', '900123', 'Servicio', 2, 100, 'Efectivo', '', 'COP', 'P1', 0, 0, 0, 0, 0, 'Observación', 'Nota producto', 'Ana', 'Encabezado', 'Pie'])]), 'Facturas de venta')
  return readSalesInvoicesWorkbook(XLSX.write(book, { type: 'array', bookType: 'xlsx' }), catalogs, [customer])
}
const send = (input = rows()) => sendImportedSupportDocuments(input, vi.fn(), 'sales')

beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-19T15:00:00Z'))
  vi.resetAllMocks(); stored.clear(); setActiveCompanyId(null); setActiveCompanyId('company-a')
  vi.mocked(apiClient.get).mockImplementation(async (url, config) => ({ data:
    url === '/integrations/jarvis/catalogs' ? { taxes: [], currencies: [{ code: 'COP' }] }
      : String(url).startsWith('/integrations/jarvis/drafts/') ? { draft: stored.get(String(url).split('/').at(-1)!) }
        : { items: url === '/integrations/jarvis/terceros' ? [customer] : url === '/integrations/jarvis/payment-methods' ? catalogs.paymentMethods
          : url === '/integrations/jarvis/sellers' ? catalogs.sellers : url === '/integrations/jarvis/drafts'
            ? [...stored].filter(([, draft]) => draft.documentKind === (config?.params as { kind: string }).kind).map(([id]) => ({ id })) : [] } }))
  vi.mocked(apiClient.put).mockImplementation(async (url, payload) => {
    stored.set(String(url).split('/').at(-1)!, payload as { documentKind: string; state: StoredState })
    return { data: {} }
  })
  vi.mocked(apiClient.post).mockResolvedValue({ data: { success: true, invoice: { id: 'provider-id', historyId: 'history-id', number: 42, date: '2026-11-19' } } })
  vi.mocked(claimSalesImportDraft).mockImplementation(async id => {
    const draft = stored.get(id)!
    if (draft.state.importDelivery) throw new Error('El borrador ya tiene un envío en curso.')
    draft.state.importDelivery = { status: 'sending' }
    return 'claim'
  })
  vi.mocked(completeSalesImportDraft).mockImplementation(async (id, _token, invoiceId) => {
    stored.get(id)!.state.importDelivery = { status: 'sent', ...(invoiceId ? { invoiceId } : {}) }
  })
})
afterEach(() => vi.useRealTimers())

it('guarda como factura de venta y envía al endpoint de facturas con vendedores, notas y pago', async () => {
  vi.mocked(apiClient.post).mockImplementation(async () => {
    expect([...stored.values()][0]).toMatchObject({ documentKind: 'ELECTRONIC_INVOICE', state: { importSource: 'sales-excel-v1', importDelivery: { status: 'sending' } } })
    return { data: { success: true, invoice: { id: 'provider-id', historyId: 'history-id', number: 42, date: '2026-11-19' } } }
  })
  const result = await send()
  expect(apiClient.post).toHaveBeenCalledExactlyOnceWith('/integrations/jarvis/invoices', expect.objectContaining({ customerName: 'Mi cliente', customerIdentification: '900123',
    sellerIds: ['seller'], headNote: 'Encabezado', footNote: 'Pie', observations: 'Observación',
    payment: { id: 10, payment_form_id: 1, due_date: '2026-11-19' },
    paymentBreakdown: [{ methodId: 'cash', methodName: 'Efectivo', nextpymeMethodId: 10, negotiation: 'CASH', amount: 200 }],
    items: [{ code: 'P1', description: 'Servicio', notes: 'Nota producto', quantity: 2, unitValue: 100, discount: 0, taxAmount: 0 }],
  }))
  expect(result[0]).toMatchObject({ delivery: 'sent', invoiceId: 'history-id' })
  expect([...stored.values()][0].state.importDelivery).toEqual({ status: 'sent', invoiceId: 'history-id' })
})

it('bloquea todo el lote si hay errores, pagos inválidos o vendedores retirados', async () => {
  const input = rows(['A', 'B']); input[1].errors = ['Error Excel']
  await expect(send(input)).rejects.toThrow('Corrige')
  input[1].errors = []; input[1].state.paymentEntries[0].methodId = 'inexistente'
  await expect(send(input)).rejects.toThrow('forma de pago')
  input[1].state.paymentEntries[0].methodId = 'cash'; input[1].state.selectedSellers = [{ id: 'retirado', name: 'Retirado' }]
  await expect(send(input)).rejects.toThrow('vendedor')
  expect(apiClient.put).not.toHaveBeenCalled()
  expect(apiClient.post).not.toHaveBeenCalled()
})

it('revalida clientes antes de emitir y bloquea si ya no existen', async () => {
  const original = vi.mocked(apiClient.get).getMockImplementation()!
  vi.mocked(apiClient.get).mockImplementation(async (url, config) => url === '/integrations/jarvis/terceros' ? { data: { items: [] } } : original(url, config))
  await expect(send()).rejects.toThrow('Debes crearlos primero')
  expect(apiClient.put).not.toHaveBeenCalled()
  expect(apiClient.post).not.toHaveBeenCalled()
})

it('conserva envíos parciales y reconoce respuestas perdidas al recargar el Excel', async () => {
  vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('Respuesta perdida'))
  const first = await send(rows(['A', 'B']))
  expect(first.map(row => row.delivery)).toEqual(['uncertain', 'sent'])
  const reopened = await send(rows(['A', 'B']))
  expect(reopened.map(row => row.delivery)).toEqual(['uncertain', 'sent'])
  expect(apiClient.post).toHaveBeenCalledTimes(2)
})

it('conserva un borrador de ventas editado y solo retoma el que coincide con el Excel', async () => {
  vi.mocked(apiClient.post).mockRejectedValue(new Error('Respuesta perdida'))
  await send()
  const draft = [...stored.values()][0]
  delete draft.state.importDelivery
  draft.state.headNote = 'Encabezado modificado'
  vi.mocked(apiClient.post).mockClear()
  expect((await send())[0].status).toBe('duplicate')
  expect(apiClient.post).not.toHaveBeenCalled()
  draft.state.headNote = 'Encabezado'
  vi.mocked(apiClient.post).mockResolvedValue({ data: { success: true, invoice: { id: 'new', date: '2026-11-19' } } })
  expect((await send())[0].delivery).toBe('sent')
  expect(apiClient.post).toHaveBeenCalledTimes(1)
})

it('no emite un borrador de soporte como factura de venta', async () => {
  const original = vi.mocked(apiClient.get).getMockImplementation()!
  vi.mocked(apiClient.get).mockImplementation(async (url, config) => {
    if (String(url).startsWith('/integrations/jarvis/drafts/')) return { data: { draft: { ...stored.get(String(url).split('/').at(-1)!)!, documentKind: 'SUPPORT_DOCUMENT' } } }
    return original(url, config)
  })
  const result = await send()
  expect(result[0].message).toContain('no es una factura de venta')
  expect(apiClient.post).not.toHaveBeenCalled()
})

it('detiene la emisión si cambia la empresa después de guardar el intento', async () => {
  const original = vi.mocked(claimSalesImportDraft).getMockImplementation()!
  vi.mocked(claimSalesImportDraft).mockImplementation(async (id, state) => {
    const token = await original(id, state)
    setActiveCompanyId('company-b')
    return token
  })
  await send()
  expect(apiClient.post).not.toHaveBeenCalled()
})

it('no emite con una fecha distinta a la fecha actual de Colombia', async () => {
  const input = rows()
  input[0].state.issueDate = '2026-11-18'
  await expect(send(input)).rejects.toThrow('fecha actual de Colombia')
  expect(apiClient.put).not.toHaveBeenCalled()
  expect(apiClient.post).not.toHaveBeenCalled()
})

it('no envía si otra pestaña reservó la referencia o se pierde la respuesta de la reserva', async () => {
  vi.mocked(claimSalesImportDraft).mockRejectedValue(new Error('Reserva no confirmada'))
  const result = await send()
  expect(result[0].delivery).toBe('uncertain')
  expect(apiClient.post).not.toHaveBeenCalled()
})

it('dos sesiones con el mismo borrador no emiten dos veces', async () => {
  await send()
  delete [...stored.values()][0].state.importDelivery
  vi.mocked(apiClient.post).mockClear()
  const [first, second] = await Promise.all([send(), send()])
  expect(apiClient.post).toHaveBeenCalledTimes(1)
  expect([first[0].delivery, second[0].delivery]).toEqual(expect.arrayContaining(['sent']))
})
