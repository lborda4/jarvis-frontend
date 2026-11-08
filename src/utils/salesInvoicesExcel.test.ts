import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import type { JarvisTercero } from '../types/jarvis'
import { createSupportDocumentsTemplate } from './supportDocumentsExcel'
import { createSalesInvoicesTemplate, readSalesInvoicesWorkbook, resolveSalesCustomers, SALES_INVOICE_EXCEL_COLUMNS, type SalesInvoiceImportCatalogs } from './salesInvoicesExcel'

const customer = { id: 'client', document_type: 'CC', document_number: '001234', name: 'Cliente', check_digit: null } as JarvisTercero
const catalogs: SalesInvoiceImportCatalogs = { currencies: ['COP'], paymentMethods: [{ id: 'cash', name: 'Efectivo', negotiation: 'CASH', nextpymeMethodId: 10, nextpymeMethodName: 'Efectivo' }, { id: 'credit', name: 'Crédito clientes', negotiation: 'CREDIT', nextpymeMethodId: 1, nextpymeMethodName: 'Otro' }], sellers: [{ id: 'ana', name: 'Ana' }, { id: 'luis', name: 'Luis' }], taxes: [{ id: 'iva', name: 'IVA', type: 'IVA', percentage: 19, category: 'IMPUESTO', catalogId: 1 }] }
const line = (changes: Record<number, unknown> = {}) => {
  const row: unknown[] = ['FV-1', '2026-11-07', 'CC', '001234', 'Servicio', 2, '1250,50', 'Efectivo']
  Object.entries(changes).forEach(([column, value]) => { row[Number(column)] = value })
  return row
}
function buffer(rows: unknown[][], edit?: (sheet: XLSX.WorkSheet) => void) {
  const book = createSalesInvoicesTemplate(catalogs)
  XLSX.utils.sheet_add_aoa(book.Sheets['Facturas de venta'], rows, { origin: 'A2' })
  edit?.(book.Sheets['Facturas de venta'])
  return XLSX.write(book, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
}
const read = (rows: unknown[][]) => readSalesInvoicesWorkbook(buffer(rows), catalogs, [customer])

describe('plantilla Excel de facturas de venta', () => {
  it('genera la hoja de ventas, ocho obligatorios, vendedores y texto para las identificaciones', () => {
    const book = XLSX.read(buffer([]), { type: 'array', cellNF: true })
    expect(book.SheetNames).toContain('Facturas de venta')
    expect(book.SheetNames).toContain('Vendedores')
    expect(book.SheetNames).not.toContain('Documentos soporte')
    expect(SALES_INVOICE_EXCEL_COLUMNS.filter(header => header.endsWith('*'))).toHaveLength(8)
    expect(book.Sheets['Facturas de venta'].D2.z).toBe('@')
    expect(book.Sheets['Facturas de venta'].U1001.z).toBe('@')
    expect(book.Sheets.Vendedores.A2.v).toBe('Ana')
  })
  it('agrupa ítems y conserva los importes, el cliente y un estado editable', () => {
    const [row] = read([line(), line({ 4: 'Otro servicio', 5: 1, 6: 100 })])
    expect(row.status).toBe('ready')
    expect(row.state.selectedCustomer?.name).toBe('Cliente')
    expect(row.identification).toBe('001234')
    expect(row.state.lines).toHaveLength(2)
    expect(row.state.documentTotal).toBe(2601)
    expect(row.state.paymentEntries[0]).toMatchObject({ methodId: 'cash', amount: '2601', automatic: true })
  })
  it('conserva los vendedores, notas, descuento e IVA elegidos en la factura', () => {
    const [row] = read([line({ 5: 1, 6: 100, 11: 10, 12: 19, 18: 'Luis;Ana;ANA', 19: 'Encabezado', 20: 'Nota al pie' })])
    expect(row.errors).toEqual([])
    expect(row.state).toMatchObject({ selectedSellers: catalogs.sellers, headNote: 'Encabezado', footNote: 'Nota al pie', documentTotal: 107.1 })
    expect(row.state.lines[0]).toMatchObject({ discount: '10', taxChargeId: 'iva', taxPercent: '19' })
  })
  it('bloquea clientes faltantes y permite volver a validarlos tras crearlos', () => {
    const rows = readSalesInvoicesWorkbook(buffer([line()]), catalogs, [])
    expect(rows[0].status).toBe('missing_supplier')
    expect(rows[0].message).toContain('facturas de venta')
    expect(resolveSalesCustomers(rows, [customer])[0].status).toBe('ready')
    expect(resolveSalesCustomers(rows, [{ ...customer, document_type: 'NIT' }])[0].status).toBe('missing_supplier')
  })
  it('valida el vencimiento y la forma de pago a crédito', () => {
    expect(read([line({ 7: 'Crédito clientes' })])[0].status).toBe('invalid')
    const [row] = read([line({ 7: 'Crédito clientes', 8: '2026-12-07' })])
    expect(row.errors).toEqual([])
    expect(row.state.paymentFormId).toBe('2')
    expect(row.state.paymentEntries[0].methodId).toBe('credit')
  })
  it('no asigna vendedores desconocidos o ambiguos', () => {
    expect(read([line({ 18: 'Desconocido' })])[0].status).toBe('invalid')
    const ambiguous = { ...catalogs, sellers: [{ id: 'a', name: 'Ana' }, { id: 'b', name: 'Ana' }] }
    expect(readSalesInvoicesWorkbook(buffer([line({ 18: 'Ana' })]), ambiguous, [customer])[0].status).toBe('invalid')
  })
  it('exige que vendedores y notas coincidan en los ítems de una misma referencia', () => {
    expect(read([line({ 18: 'Ana' }), line({ 18: 'Luis' })])[0].errors.join(' ')).toContain('vendedores')
    expect(read([line({ 19: 'Nota' }), line({ 19: 'Diferente' })])[0].status).toBe('invalid')
  })
  it('rechaza plantillas de soporte, encabezados alterados y fórmulas', () => {
    const support = createSupportDocumentsTemplate(catalogs)
    expect(() => readSalesInvoicesWorkbook(XLSX.write(support, { type: 'array', bookType: 'xlsx' }), catalogs, [])).toThrow('hoja Facturas de venta')
    expect(() => readSalesInvoicesWorkbook(buffer([], sheet => { sheet.A1.v = 'Otro' }), catalogs, [])).toThrow('encabezados')
    expect(readSalesInvoicesWorkbook(buffer([line()], sheet => { sheet.S2 = { t: 's', f: '"Ana"', v: 'Ana' } }), catalogs, [customer])[0].status).toBe('invalid')
  })
})
