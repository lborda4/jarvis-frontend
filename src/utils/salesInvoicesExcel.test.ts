import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import * as CFB from 'cfb'
import type { JarvisTercero } from '../types/jarvis'
import { createSupportDocumentsTemplate } from './supportDocumentsExcel'
import { createSalesInvoicesTemplate, createSalesInvoicesTemplateFile, readSalesInvoicesWorkbook, resolveSalesCustomers, SALES_INVOICE_EXCEL_COLUMNS, LEGACY_SALES_INVOICE_EXCEL_COLUMNS, type SalesInvoiceImportCatalogs } from './salesInvoicesExcel'

const customer = { id: 'client', document_type: 'CC', document_number: '001234', name: 'Cliente', check_digit: null } as JarvisTercero
const catalogs: SalesInvoiceImportCatalogs = { currencies: ['COP'], paymentMethods: [{ id: 'cash', name: 'Efectivo', negotiation: 'CASH', nextpymeMethodId: 10, nextpymeMethodName: 'Efectivo' }, { id: 'credit', name: 'Crédito clientes', negotiation: 'CREDIT', nextpymeMethodId: 1, nextpymeMethodName: 'Otro' }], sellers: [{ id: 'ana', name: 'Ana' }, { id: 'luis', name: 'Luis' }], taxes: [{ id: 'iva', name: 'IVA', type: 'IVA', percentage: 19, category: 'IMPUESTO', catalogId: 1 }] }
const line = (changes: Record<number, unknown> = {}) => {
  const row: unknown[] = ['FV-1', '2026-11-07', 'CC', '001234', 'Servicio', 2, '1250,50', 'Efectivo']
  Object.entries(changes).forEach(([column, value]) => { row[Number(column)] = value })
  return row
}
function buffer(rows: unknown[][], edit?: (sheet: XLSX.WorkSheet) => void) {
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([[...LEGACY_SALES_INVOICE_EXCEL_COLUMNS]]), 'Facturas de venta')
  XLSX.utils.sheet_add_aoa(book.Sheets['Facturas de venta'], rows, { origin: 'A2' })
  edit?.(book.Sheets['Facturas de venta'])
  return XLSX.write(book, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
}
const read = (rows: unknown[][]) => readSalesInvoicesWorkbook(buffer(rows), catalogs, [customer])
const modernCatalogs = { ...catalogs, products: [{ sku: '001', name: 'Mi producto' }] }
function modernBuffer(rows: unknown[][], edit?: (sheet: XLSX.WorkSheet) => void, options: SalesInvoiceImportCatalogs = modernCatalogs) {
  const book = createSalesInvoicesTemplate(options)
  XLSX.utils.sheet_add_aoa(book.Sheets['Facturas de venta'], rows, { origin: 'A2' })
  edit?.(book.Sheets['Facturas de venta'])
  return XLSX.write(book, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
}
const modernLine = (changes: Record<string, unknown> = {}) => SALES_INVOICE_EXCEL_COLUMNS.map(header => ({
  'Grupo de documento *': 'VENTA-A', 'Fecha de emisión *': '2026-11-19', 'Tipo de documento *': 'CC',
  'NIT / identificación *': '001234', 'Producto': '001', 'Descripción *': 'Mi producto', 'Cantidad *': 2,
  'Valor unitario *': 100, 'Forma de pago *': 'Efectivo', ...changes,
} as Record<string, unknown>)[header] ?? '')

describe('plantilla Excel de facturas de venta', () => {
  it('genera una sola hoja de ventas con ocho obligatorios, ejemplo y catálogos ocultos', () => {
    const book = XLSX.read(createSalesInvoicesTemplateFile(catalogs), { type: 'array', cellNF: true, cellStyles: true })
    expect(book.SheetNames).toEqual(['Facturas de venta'])
    expect(SALES_INVOICE_EXCEL_COLUMNS.filter(header => header.endsWith('*'))).toHaveLength(8)
    expect(book.Sheets['Facturas de venta'].D2.z).toBe('@')
    expect(book.Sheets['Facturas de venta'].U1001.z).toBe('@')
    expect(book.Sheets['Facturas de venta'].A2.v).toBe('FV-001')
    expect(book.Sheets['Facturas de venta']['!cols']?.slice(SALES_INVOICE_EXCEL_COLUMNS.length).every(column => column.hidden)).toBe(true)
    const sellerRange = book.Workbook!.Names!.find(item => item.Name === 'VendedoresVenta')!
    expect(sellerRange.Ref).toContain("'Facturas de venta'!")
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
  it('incluye nueve desplegables reales en el archivo de Excel y congela los encabezados', () => {
    const buffer = createSalesInvoicesTemplateFile(modernCatalogs)
    const archive = CFB.read(new Uint8Array(buffer), { type: 'buffer' })
    const xml = new TextDecoder().decode(new Uint8Array(CFB.find(archive, '/xl/worksheets/sheet1.xml')!.content))
    for (const name of ['TiposIdentificacionVenta', 'FormasPagoVenta', 'TarifasIVAVenta', 'TarifasRetefuenteVenta', 'TarifasReteICAVenta', 'TarifasReteIVAVenta', 'CodigosProductosVenta', 'MonedasVenta', 'VendedoresVenta']) expect(xml).toContain(`<formula1>${name}</formula1>`)
    expect(xml).toContain('errorStyle="stop"')
    expect(xml).toContain('state="frozen"')
    expect(xml).toContain('sqref="S2:S1001"')
  })
  it('importa la plantilla nueva agrupando productos y conserva moneda, vendedores, notas y tarifas', () => {
    const changes = { 'Moneda': 'COP', 'Vendedores': 'Ana', 'Nota de encabezado': 'Encabezado', 'Nota al pie': 'Pie', 'IVA (%)': 19 }
    const input = modernBuffer([modernLine({ ...changes, 'Nota del ítem': 'Nota producto' }), modernLine({ ...changes, 'Descripción *': 'Otro producto', 'Cantidad *': 1 })])
    const [row] = readSalesInvoicesWorkbook(input, modernCatalogs, [customer])
    expect(row.errors).toEqual([])
    expect(row.sourceRows).toEqual([2, 3])
    expect(row.identification).toBe('001234')
    expect(row.state).toMatchObject({ documentTotal: 357, currency: 'COP', selectedSellers: [{ id: 'ana', name: 'Ana' }], headNote: 'Encabezado', footNote: 'Pie' })
    expect(row.state.lines[0]).toMatchObject({ code: '001', notes: 'Nota producto', taxChargeId: 'iva', taxPercent: '19' })
    expect(row.state.lines).toHaveLength(2)
  })
  it('valida productos, moneda y fórmulas de la plantilla nueva antes de guardar', () => {
    const input = modernBuffer([modernLine({ 'Producto': 'NO-EXISTE', 'Moneda': 'XYZ', 'Vendedores': 'Ajeno' }), modernLine({ 'Grupo de documento *': 'B' })], sheet => { sheet.U3 = { t: 's', v: 'Nota', f: '"Nota"' } })
    const rows = readSalesInvoicesWorkbook(input, modernCatalogs, [customer])
    expect(rows.every(row => row.status === 'invalid')).toBe(true)
    expect(rows[0].errors).toHaveLength(3)
    expect(rows[1].errors.join(' ')).toContain('fórmulas')
  })
  it('conserva los catálogos ocultos sin contarlos como filas y rechaza columnas extra visibles', () => {
    const options = { ...modernCatalogs, products: Array.from({ length: 1100 }, (_, i) => ({ sku: `P${i}` })) }
    const input = modernBuffer([modernLine({ 'Producto': 'P1099' })], undefined, options)
    expect(readSalesInvoicesWorkbook(input, options, [customer])).toHaveLength(1)
    const invalid = modernBuffer([modernLine()], sheet => { sheet['!cols']![SALES_INVOICE_EXCEL_COLUMNS.length].hidden = false })
    expect(() => readSalesInvoicesWorkbook(invalid, modernCatalogs, [customer])).toThrow('formato')
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
  it('conserva la moneda seleccionada en facturas de venta', () => {
    const [row] = readSalesInvoicesWorkbook(buffer([line({ 9: 'USD' })]), { ...catalogs, currencies: ['COP', 'USD'] }, [customer])
    expect(row.errors).toEqual([])
    expect(row.state.currency).toBe('USD')
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
