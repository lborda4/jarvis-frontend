import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as XLSX from 'xlsx'
import { createJarvisSupportInvoice } from './jarvisService'
import { fetchInvoiceDraft, saveInvoiceDraft } from './invoiceDraftService'
import { fetchSupportImportCatalogs, saveImportedSupportDocuments } from './supportDocumentsImportService'
import { buildImportedSupportRequest, sendImportedSupportDocuments } from './supportDocumentsBulkSendService'
import { setActiveCompanyId } from './queryCache'
import { LEGACY_SUPPORT_EXCEL_COLUMNS, readSupportDocumentsWorkbook, type SupportImportCatalogs } from '../utils/supportDocumentsExcel'
import type { InvoiceDraftState } from '../types/invoiceDraft'
import type { JarvisTercero } from '../types/jarvis'

vi.mock('./jarvisService', () => ({ createJarvisSupportInvoice: vi.fn() }))
vi.mock('./invoiceDraftService', () => ({ fetchInvoiceDraft: vi.fn(), saveInvoiceDraft: vi.fn() }))
vi.mock('./supportDocumentsImportService', () => ({ fetchSupportImportCatalogs: vi.fn(), saveImportedSupportDocuments: vi.fn() }))

const catalogs: SupportImportCatalogs = { taxes: [], currencies: ['COP'], paymentMethods: [{ id: 'cash', name: 'Efectivo', negotiation: 'CASH', nextpymeMethodId: 10, nextpymeMethodName: 'Efectivo' }] }
function rows(references = ['COMPRA-A']) {
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([[...LEGACY_SUPPORT_EXCEL_COLUMNS],
    ...references.map(reference => [reference, '2026-11-18', 'NIT', '900123', 'Servicio', 2, 100, 'Efectivo'])]), 'Documentos soporte')
  return readSupportDocumentsWorkbook(XLSX.write(book, { type: 'array', bookType: 'xlsx' }), catalogs,
    [{ id: 'supplier', document_type: 'NIT', document_number: '900123', name: 'Mi empresa' } as JarvisTercero])
    .map((row, index) => ({ ...row, draftId: `draft-${index}` }))
}
let stored: Map<string, InvoiceDraftState>
beforeEach(() => {
  vi.resetAllMocks()
  setActiveCompanyId('company-a')
  stored = new Map()
  vi.mocked(fetchSupportImportCatalogs).mockResolvedValue(catalogs)
  vi.mocked(saveImportedSupportDocuments).mockImplementation(async (input, progress) => input.map(row => {
    const updated = { ...row, status: row.status === 'duplicate' ? 'duplicate' as const : 'saved' as const }
    if (!stored.has(row.draftId!)) stored.set(row.draftId!, row.state)
    progress(updated)
    return updated
  }))
  vi.mocked(fetchInvoiceDraft).mockImplementation(async id => ({ documentKind: 'SUPPORT_DOCUMENT', state: stored.get(id)! }) as Awaited<ReturnType<typeof fetchInvoiceDraft>>)
  vi.mocked(saveInvoiceDraft).mockImplementation(async (id, _kind, state) => { stored.set(id, state as InvoiceDraftState) })
  vi.mocked(createJarvisSupportInvoice).mockResolvedValue({ success: true, invoice: { id: 'provider-id', historyId: 'history-id', number: 42, date: '2026-11-18' } })
})

describe('envío masivo de documentos soporte importados', () => {
  it('envía datos del Excel y guarda el intento antes de emitir y la confirmación después', async () => {
    vi.mocked(createJarvisSupportInvoice).mockImplementation(async () => {
      expect(stored.get('draft-0')?.importDelivery?.status).toBe('sending')
      return { success: true, invoice: { id: 'provider-id', historyId: 'history-id', number: 42, date: '2026-11-18' } }
    })
    const result = await sendImportedSupportDocuments(rows(), vi.fn())
    expect(createJarvisSupportInvoice).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ customerIdentification: '900123', customerName: 'Mi empresa',
      issueDate: '2026-11-18', items: [{ description: 'Servicio', quantity: 2, unitValue: 100, discount: 0, taxAmount: 0 }],
      payment: { id: 10, payment_form_id: 1, due_date: '2026-11-18' } }))
    expect(result[0]).toMatchObject({ delivery: 'sent', invoiceId: 'history-id' })
    expect(stored.get('draft-0')?.importDelivery).toEqual({ status: 'sent', invoiceId: 'history-id' })
  })
  it('mantiene todos los ítems, códigos, impuestos y retenciones con sus IDs del catálogo', () => {
    const row = rows()[0]
    row.state.lines[0] = { ...row.state.lines[0], code: 'P-01', taxChargeId: 'iva', taxPercent: '19', taxRetentionId: 'rete', discount: '20' }
    row.state.lines.push({ ...row.state.lines[0], id: 'second', code: 'P-02', description: 'Otro producto' })
    row.state.reteIcaId = 'ica'
    const request = buildImportedSupportRequest(row, { ...catalogs, taxes: [
      { id: 'iva', name: 'IVA', type: 'IVA', percentage: 19, category: 'IMPUESTO', catalogId: 1 },
      { id: 'rete', name: 'Retefuente', type: 'RETERENTA', percentage: 4, category: 'RETENCION', catalogId: 2 },
      { id: 'ica', name: 'ReteICA', type: 'RETEICA', percentage: 9.66, category: 'RETENCION', catalogId: 3 },
    ] })
    expect(request.items).toHaveLength(2)
    expect(request.items[0]).toMatchObject({ code: 'P-01', taxAmount: 34.2, taxId: 1, retention: { id: 2, percentage: 4 } })
    expect(request.items[1].code).toBe('P-02')
    expect(request.retentions).toEqual([{ id: 3, type: 'RETEICA', percentage: 9.66 }])
  })
  it('bloquea todo el lote si hay errores o NIT faltantes', async () => {
    const input = rows(['A', 'B']); input[1].errors = ['Falta descripción']
    await expect(sendImportedSupportDocuments(input, vi.fn())).rejects.toThrow('Corrige')
    input[1].errors = []; input[1].status = 'missing_supplier'
    await expect(sendImportedSupportDocuments(input, vi.fn())).rejects.toThrow('crea los terceros')
    expect(saveImportedSupportDocuments).not.toHaveBeenCalled()
    expect(createJarvisSupportInvoice).not.toHaveBeenCalled()
  })
  it('valida todos los pagos e impuestos antes de guardar o enviar', async () => {
    const input = rows(['A', 'B']); input[1].state.paymentEntries[0].methodId = 'removed'
    await expect(sendImportedSupportDocuments(input, vi.fn())).rejects.toThrow('forma de pago')
    expect(saveImportedSupportDocuments).not.toHaveBeenCalled()
    expect(createJarvisSupportInvoice).not.toHaveBeenCalled()
  })
  it('no emite mientras haya documentos que no se pudieron guardar', async () => {
    vi.mocked(saveImportedSupportDocuments).mockImplementation(async input => input.map((row, index) => ({ ...row, status: index ? 'failed' : 'saved' })))
    const result = await sendImportedSupportDocuments(rows(['A', 'B']), vi.fn())
    expect(result[1].status).toBe('failed')
    expect(createJarvisSupportInvoice).not.toHaveBeenCalled()
  })
  it('omite referencias preexistentes', async () => {
    const input = rows(); input[0].status = 'duplicate'
    expect((await sendImportedSupportDocuments(input, vi.fn()))[0].status).toBe('duplicate')
    expect(createJarvisSupportInvoice).not.toHaveBeenCalled()
  })
  it('retoma un borrador importado sin cambios al volver a cargar el Excel', async () => {
    const input = rows(); input[0].status = 'duplicate'
    stored.set('draft-0', { ...input[0].state, importSource: 'support-excel-v1', importReference: 'COMPRA-A' } as InvoiceDraftState)
    expect((await sendImportedSupportDocuments(input, vi.fn()))[0].delivery).toBe('sent')
    expect(createJarvisSupportInvoice).toHaveBeenCalledTimes(1)
  })
  it('conserva un borrador editado sin sobrescribirlo ni enviarlo con los datos originales del Excel', async () => {
    const input = rows(); input[0].status = 'duplicate'
    stored.set('draft-0', { ...input[0].state, notes: 'Observación editada', importSource: 'support-excel-v1', importReference: 'COMPRA-A' } as InvoiceDraftState)
    expect((await sendImportedSupportDocuments(input, vi.fn()))[0].status).toBe('duplicate')
    expect(createJarvisSupportInvoice).not.toHaveBeenCalled()
    expect(saveInvoiceDraft).not.toHaveBeenCalled()
    expect(stored.get('draft-0')?.notes).toBe('Observación editada')
  })
  it('reconoce el comprobante de un envío anterior al volver a cargar el Excel', async () => {
    const input = rows(); input[0].status = 'duplicate'
    stored.set('draft-0', { ...input[0].state, importDelivery: { status: 'sent', invoiceId: 'history-previous' } })
    expect((await sendImportedSupportDocuments(input, vi.fn()))[0]).toMatchObject({ delivery: 'sent', invoiceId: 'history-previous' })
    expect(createJarvisSupportInvoice).not.toHaveBeenCalled()
  })
  it('conserva éxitos parciales y no reenvía documentos con una respuesta perdida', async () => {
    vi.mocked(createJarvisSupportInvoice).mockRejectedValueOnce(new Error('Respuesta perdida'))
    const first = await sendImportedSupportDocuments(rows(['A', 'B']), vi.fn())
    expect(first.map(row => row.delivery)).toEqual(['uncertain', 'sent'])
    await sendImportedSupportDocuments(first, vi.fn())
    expect(createJarvisSupportInvoice).toHaveBeenCalledTimes(2)
    // A fresh in-memory session also reads the durable checkpoint.
    const reopened = rows().map(row => ({ ...row, status: 'saved' as const }))
    expect((await sendImportedSupportDocuments(reopened, vi.fn()))[0].delivery).toBe('uncertain')
    expect(createJarvisSupportInvoice).toHaveBeenCalledTimes(2)
  })
  it('mantiene el envío confirmado aunque falle el guardado final del comprobante', async () => {
    vi.mocked(saveInvoiceDraft).mockImplementationOnce(async (id, _kind, state) => { stored.set(id, state as InvoiceDraftState) }).mockRejectedValueOnce(new Error('Sin conexión'))
    const result = await sendImportedSupportDocuments(rows(), vi.fn())
    expect(result[0].delivery).toBe('sent')
    expect(result[0].message).toContain('envío está confirmado')
    await sendImportedSupportDocuments(result, vi.fn())
    expect(createJarvisSupportInvoice).toHaveBeenCalledTimes(1)
  })
  it('reintenta la preparación fallida sin emitir hasta guardar el intento', async () => {
    vi.mocked(saveInvoiceDraft).mockRejectedValueOnce(new Error('No se pudo guardar'))
    const first = await sendImportedSupportDocuments(rows(), vi.fn())
    expect(first[0].delivery).toBeUndefined()
    expect(createJarvisSupportInvoice).not.toHaveBeenCalled()
    expect((await sendImportedSupportDocuments(first, vi.fn()))[0].delivery).toBe('sent')
  })
  it('no presenta una respuesta sin confirmación como enviada', async () => {
    vi.mocked(createJarvisSupportInvoice).mockResolvedValue({ success: false, invoice: { id: '', date: '' } })
    expect((await sendImportedSupportDocuments(rows(), vi.fn()))[0].delivery).toBe('uncertain')
  })
  it('detiene el envío si cambia la empresa después de guardar el intento', async () => {
    vi.mocked(saveInvoiceDraft).mockImplementation(async () => { setActiveCompanyId('company-b') })
    await sendImportedSupportDocuments(rows(), vi.fn())
    expect(createJarvisSupportInvoice).not.toHaveBeenCalled()
  })
})
