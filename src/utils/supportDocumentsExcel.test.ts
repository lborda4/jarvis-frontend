import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import type { JarvisTercero } from '../types/jarvis'
import { createSupportDocumentsTemplate, readSupportDocumentsWorkbook, resolveSupportSuppliers, SUPPORT_EXCEL_COLUMNS, type SupportImportCatalogs } from './supportDocumentsExcel'

const supplier = { id: 'supplier', document_type: 'NIT', document_number: '001234567', name: 'Proveedor', check_digit: '0' } as JarvisTercero
const catalogs: SupportImportCatalogs = {
  currencies: ['COP', 'USD'], paymentMethods: [
    { id: 'cash', name: 'Efectivo', negotiation: 'CASH', nextpymeMethodId: 10, nextpymeMethodName: 'Efectivo' },
    { id: 'credit', name: 'Crédito', negotiation: 'CREDIT', nextpymeMethodId: 1, nextpymeMethodName: 'Otro' },
  ],
  taxes: [
    { id: 'iva19', name: 'IVA', type: 'IVA', percentage: 19, category: 'IMPUESTO', catalogId: 1 },
    { id: 'rete2.5', name: 'Retefuente', type: 'Retefuente', percentage: 2.5, category: 'RETENCION', catalogId: 6 },
    { id: 'ica6.9', name: 'ReteICA', type: 'ReteICA', percentage: 6.9, category: 'RETENCION', catalogId: 7 },
    { id: 'reteiva15', name: 'ReteIVA', type: 'ReteIVA', percentage: 15, category: 'RETENCION', catalogId: 5 },
  ],
}
const line = (changes: Record<number, unknown> = {}) => {
  const row: unknown[] = ['REF-001', '2026-11-07', 'NIT', '001234567', 'Servicio', '2', '100', 'Efectivo']
  Object.entries(changes).forEach(([column, value]) => { row[Number(column)] = value })
  return row
}
function buffer(rows: unknown[][], edit?: (sheet: XLSX.WorkSheet) => void) {
  const book = createSupportDocumentsTemplate(catalogs)
  XLSX.utils.sheet_add_aoa(book.Sheets['Documentos soporte'], rows, { origin: 'A2' })
  edit?.(book.Sheets['Documentos soporte'])
  return XLSX.write(book, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
}
const read = (rows: unknown[][], suppliers = [supplier]) => readSupportDocumentsWorkbook(buffer(rows), catalogs, suppliers)

describe('plantilla y lectura de documentos soporte', () => {
  it('genera una plantilla vacía con ocho obligatorios y catálogos', () => {
    const book = XLSX.read(buffer([]), { type: 'array', cellNF: true })
    expect(SUPPORT_EXCEL_COLUMNS.filter(header => header.endsWith('*'))).toHaveLength(8)
    expect(book.Sheets['Documentos soporte'].D2.z).toBe('@')
    expect(book.SheetNames).toContain('Formas de pago')
    expect(book.SheetNames).toContain('ReteICA')
    expect(() => read([])).toThrow('está vacía')
  })
  it('construye un documento editable con el proveedor guardado y el importe del pago', () => {
    const [row] = read([line()])
    expect(row.status).toBe('ready')
    expect(row.identification).toBe('001234567')
    expect(row.state).toMatchObject({ selectedCustomer: { id: 'supplier', name: 'Proveedor' }, issueDate: '2026-11-07', dueDate: '2026-11-07', documentTotal: 200, currency: 'COP', discountIsPercent: false, paymentFormId: '1', paymentEntries: [{ id: 'payment-1', methodId: 'cash', amount: '200', automatic: true }] })
    expect(row.state.lines[0]).toMatchObject({ description: 'Servicio', quantity: '2', unitValue: '100', priceOptions: [], selectedPriceId: '', taxChargeId: '', taxRetentionId: '' })
  })
  it('agrupa varios ítems sin perder sus filas originales', () => {
    const [row] = read([line(), [], line({ 5: 1, 6: 50 })])
    expect(row.sourceRows).toEqual([2, 4])
    expect(row.state.lines).toHaveLength(2)
    expect(row.state.documentTotal).toBe(250)
  })
  it('marca NIT faltantes y permite revalidar después de crearlos, sin inventar un proveedor', () => {
    const rows = read([line()], [])
    expect(rows[0].status).toBe('missing_supplier')
    expect(rows[0].state.selectedCustomer).toBeNull()
    expect(rows[0].message).toContain('Debes crear')
    expect(resolveSupportSuppliers(rows, [supplier])[0].status).toBe('ready')
    expect(resolveSupportSuppliers(rows, [{ ...supplier, document_type: 'CC' }])[0].status).toBe('missing_supplier')
  })
  it('calcula IVA, descuentos, retefuente, reteICA por mil y reteIVA sobre el IVA', () => {
    const [row] = read([line({ 11: 10, 12: 19, 13: '2,5', 14: '6,9', 15: 15, 16: 'Notas', 17: 'Nota del ítem' })])
    expect(row.errors).toEqual([])
    expect(row.state.documentTotal).toBe(214.62)
    expect(row.state).toMatchObject({ notes: 'Notas', reteIcaId: 'ica6.9', reteIvaId: 'reteiva15' })
    expect(row.state.lines[0]).toMatchObject({ taxChargeId: 'iva19', taxRetentionId: 'rete2.5', notes: 'Nota del ítem' })
  })
  it('acepta fechas ISO, día/mes/año y celdas de fecha Excel', () => {
    expect(read([line({ 1: '07/11/2026' })])[0].state.issueDate).toBe('2026-11-07')
    expect(read([line({ 1: new Date(2026, 10, 7, 12) })])[0].state.issueDate).toBe('2026-11-07')
  })
  it('valida el vencimiento a crédito y conserva la negociación del medio de pago', () => {
    expect(read([line({ 7: 'Crédito' })])[0].status).toBe('invalid')
    const [row] = read([line({ 7: 'Crédito', 8: '2026-12-07' })])
    expect(row.errors).toEqual([])
    expect(row.state.paymentFormId).toBe('2')
    expect(row.state.paymentEntries[0].methodId).toBe('credit')
  })
  it.each([
    { changes: { 0: '' } }, { changes: { 1: '2026-02-30' } }, { changes: { 2: 'XYZ' } },
    { changes: { 3: '900.123-0' } }, { changes: { 4: '' } }, { changes: { 5: 0 } },
    { changes: { 6: '1.000,50' } }, { changes: { 6: -1 } }, { changes: { 7: 'Desconocida' } },
    { changes: { 8: '2026-01-01' } }, { changes: { 9: 'XYZ' } }, { changes: { 11: 201 } },
    { changes: { 12: 100 } }, { changes: { 13: 99 } },
  ])('señala campos inválidos y sus filas: $changes', ({ changes }) => {
    const [row] = read([line(changes)])
    expect(row.status).toBe('invalid')
    expect(row.errors.length).toBeGreaterThan(0)
  })
  it('bloquea referencias cuyos ítems tienen proveedores o condiciones diferentes', () => {
    const [row] = read([line(), line({ 3: '9002' })])
    expect(row.status).toBe('invalid')
    expect(row.errors.join(' ')).toContain('mismo proveedor')
  })
  it('rechaza fórmulas, encabezados cambiados y exceso de filas', () => {
    const formulas = buffer([line()], sheet => { sheet.G2 = { t: 'n', v: 100, f: '50+50' } })
    expect(readSupportDocumentsWorkbook(formulas, catalogs, [supplier])[0].status).toBe('invalid')
    expect(() => readSupportDocumentsWorkbook(buffer([], sheet => { sheet.A1.v = 'Otro' }), catalogs, [])).toThrow('encabezados')
    const rows = Array.from({ length: 1000 }, (_, i) => line({ 0: `REF-${i}` }))
    expect(read(rows)).toHaveLength(1000)
    expect(() => read([...rows, line({ 0: 'EXTRA' })])).toThrow('máximo 1.000')
  })
})
