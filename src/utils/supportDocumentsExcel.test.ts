import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import * as CFB from 'cfb'
import type { JarvisTercero } from '../types/jarvis'
import { createSupportDocumentsTemplate, createSupportDocumentsTemplateFile, LEGACY_SUPPORT_EXCEL_COLUMNS, readSupportDocumentsWorkbook, resolveSupportSuppliers, SUPPORT_EXCEL_COLUMNS, type SupportImportCatalogs } from './supportDocumentsExcel'

const supplier = { id: 'supplier', document_type: 'NIT', document_number: '001234567', name: 'Proveedor', check_digit: '0' } as JarvisTercero
const catalogs: SupportImportCatalogs = {
  products: [{ sku: '000123' }, { sku: 'SERV-002' }],
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
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([[...LEGACY_SUPPORT_EXCEL_COLUMNS]]), 'Documentos soporte')
  XLSX.utils.sheet_add_aoa(book.Sheets['Documentos soporte'], rows, { origin: 'A2' })
  edit?.(book.Sheets['Documentos soporte'])
  return XLSX.write(book, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
}
const read = (rows: unknown[][], suppliers = [supplier]) => readSupportDocumentsWorkbook(buffer(rows), catalogs, suppliers)

describe('plantilla y lectura de documentos soporte', () => {
  it('genera una sola hoja con un ejemplo, ocho obligatorios y producto antes de descripción', () => {
    const book = XLSX.read(createSupportDocumentsTemplateFile(catalogs), { type: 'array', cellNF: true, cellStyles: true })
    expect(SUPPORT_EXCEL_COLUMNS.filter(header => header.endsWith('*'))).toHaveLength(8)
    expect(book.Sheets['Documentos soporte'].D2.z).toBe('@')
    expect(book.SheetNames).toEqual(['Documentos soporte'])
    expect(book.Sheets['Documentos soporte'].A1.v).toBe('Grupo de documento *')
    expect(book.Sheets['Documentos soporte'].A2.v).toBe('DOC-001')
    expect(SUPPORT_EXCEL_COLUMNS).not.toContain('Código producto')
    expect(SUPPORT_EXCEL_COLUMNS).not.toContain('Nota del ítem')
    expect(book.Sheets['Documentos soporte'].E1.v).toBe('Producto')
    expect(book.Sheets['Documentos soporte'].F1.v).toBe('Descripción *')
    expect(book.Sheets['Documentos soporte'].E2.z).toBe('@')
    expect(SUPPORT_EXCEL_COLUMNS).not.toContain('Moneda')
    expect(book.Sheets['Documentos soporte'].G2.t).toBe('n')
    expect(book.Sheets['Documentos soporte'].H2.z).toBe('0.00')
    expect(book.Sheets['Documentos soporte']['!cols']?.[SUPPORT_EXCEL_COLUMNS.length].hidden).toBe(true)
    const [example] = readSupportDocumentsWorkbook(createSupportDocumentsTemplateFile(catalogs), catalogs, [{ ...supplier, document_number: '900123456' }])
    expect(example.state.issueDate).toBe(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()))
    expect(example.status).toBe('ready')
    expect(example.state.currency).toBe('COP')
    expect(() => read([])).toThrow('está vacía')
  })
  it('incluye los desplegables en el archivo descargado con los catálogos reales', () => {
    const longName = 'Transferencia, banco ' + 'a'.repeat(230)
    const data = createSupportDocumentsTemplateFile({ ...catalogs, paymentMethods: [...catalogs.paymentMethods, { ...catalogs.paymentMethods[0], id: 'bank', name: longName }] })
    const archive = CFB.read(new Uint8Array(data), { type: 'buffer' })
    const xml = new TextDecoder().decode(new Uint8Array(CFB.find(archive, '/xl/worksheets/sheet1.xml')!.content))
    const book = XLSX.read(data, { type: 'array', cellStyles: true })
    expect(xml.includes('sqref="I2:I1001"')).toBe(true)
    expect(xml.includes('<formula1>FormasPagoSoporte</formula1>')).toBe(true)
    expect(xml.includes('<formula1>TiposIdentificacionSoporte</formula1>')).toBe(true)
    expect(xml.includes('<formula1>TarifasReteICASoporte</formula1>')).toBe(true)
    expect(xml.includes('errorStyle="stop"')).toBe(true)
    expect(xml.includes('showInputMessage="1"')).toBe(false)
    expect(xml.includes('showInputMessage="0"')).toBe(true)
    expect(archive.FullPaths.some(path => /comments\d*\.xml$/i.test(path))).toBe(true)
    expect(book.Sheets['Documentos soporte'].A1.c?.[0].t).toContain('Si un documento tiene 3 productos, escribe el número 1 en las tres filas.')
    expect(book.Sheets['Documentos soporte'].A1.c?.[0].t).toContain('asignará el consecutivo correspondiente a cada documento soporte.')
    expect(xml.includes('AND(ISNUMBER(G2),G2&gt;0,ROUND(G2,6)=G2)')).toBe(true)
    expect(xml.includes('ROUND(H2,2)=H2')).toBe(true)
    expect(xml.includes('AND(ISNUMBER(J2),J2&gt;=B2)')).toBe(true)
    expect(xml.includes('state="frozen"')).toBe(true)
    expect(xml.includes('MonedasSoporte')).toBe(false)
    expect(xml.includes('K2&lt;=G2*H2')).toBe(true)
    expect(xml.includes('ROUND(K2,2)=K2')).toBe(true)
    expect(book.Sheets['Documentos soporte'].R4.v).toBe(longName)
    expect(book.Workbook?.Names?.find(name => name.Name === 'FormasPagoSoporte')?.Ref).toBe("'Documentos soporte'!$R$2:$R$4")
    expect(book.Sheets['Documentos soporte'].U3.v).toBe(6.9)
    expect(xml).toContain('sqref="E2:E1001"')
    expect(xml).toContain('<formula1>CodigosProductosSoporte</formula1>')
    expect(book.Workbook?.Names?.find(name => name.Name === 'CodigosProductosSoporte')?.Ref).toBe("'Documentos soporte'!$W$2:$W$3")
    expect(book.Sheets['Documentos soporte'].W2.v).toBe('000123')
    expect(book.Sheets['Documentos soporte'].W2.t).toBe('s')
    expect(book.Sheets['Documentos soporte']['!cols']?.[22].hidden).toBe(true)
  })
  it('lee los productos elegidos y agrupa ítems conservando impuestos y notas', () => {
    const book = createSupportDocumentsTemplate(catalogs)
    const sheet = book.Sheets['Documentos soporte']
    XLSX.utils.sheet_add_aoa(sheet, [
      ['DOC-001', '2026-11-07', 'NIT', '001234567', '000123', 'Servicio', 2, 100, 'Efectivo', '', 10, 19, 2.5, 6.9, 15, 'Notas'],
      ['DOC-001', '2026-11-07', 'NIT', '001234567', 'SERV-002', 'Otro servicio', 1, 50, 'Efectivo', '', 0, 19, 2.5, 6.9, 15, 'Notas'],
    ], { origin: 'A2' })
    const [row] = readSupportDocumentsWorkbook(XLSX.write(book, { type: 'array', bookType: 'xlsx' }), catalogs, [supplier])
    expect(row.reference).toBe('DOC-001')
    expect(row.errors).toEqual([])
    expect(row.state.lines).toHaveLength(2)
    expect(row.state.lines[0]).toMatchObject({ code: '000123', productSearch: '000123', description: 'Servicio', discount: '10', taxChargeId: 'iva19', taxRetentionId: 'rete2.5' })
    expect(row.state.lines[0].notes).toBeUndefined()
    expect(row.state.lines[1].code).toBe('SERV-002')
    expect(row.state).toMatchObject({ currency: 'COP', reteIcaId: 'ica6.9', reteIvaId: 'reteiva15', notes: 'Notas' })
    expect(row.sourceRows).toEqual([2, 3])
  })
  it('rechaza códigos ajenos a la empresa y permite dejar producto vacío', () => {
    const book = createSupportDocumentsTemplate(catalogs)
    const sheet = book.Sheets['Documentos soporte']
    sheet.D2.v = supplier.document_number
    sheet.E2.v = 'PRODUCTO-OTRA-EMPRESA'
    const readBook = () => readSupportDocumentsWorkbook(XLSX.write(book, { type: 'array', bookType: 'xlsx' }), catalogs, [supplier])[0]
    expect(readBook().errors.join(' ')).toContain('no existe en el catálogo de esta empresa')
    sheet.E2.v = ''
    expect(readBook().status).toBe('ready')
  })
  it('no importa las filas ocultas de catálogos con más de mil productos', () => {
    const largeCatalogs = { ...catalogs, products: Array.from({ length: 1005 }, (_, index) => ({ sku: `PROD-${index}` })) }
    const data = createSupportDocumentsTemplateFile(largeCatalogs)
    const book = XLSX.read(data, { type: 'array' })
    expect(book.Sheets['Documentos soporte'].W1006.v).toBe('PROD-1004')
    expect(readSupportDocumentsWorkbook(data, largeCatalogs, [{ ...supplier, document_number: '900123456' }])).toHaveLength(1)
  })
  it('sigue leyendo la plantilla anterior sin producto ni moneda', () => {
    const headers = LEGACY_SUPPORT_EXCEL_COLUMNS.filter(header => header !== 'Código producto' && header !== 'Moneda')
      .map(header => header === 'Referencia *' ? 'Grupo de documento *' : header)
    const oldRow = Array.from(line({ 11: 10, 12: 19 })).filter((_, column) => column !== 9 && column !== 10)
    const book = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([headers, oldRow]), 'Documentos soporte')
    const [row] = readSupportDocumentsWorkbook(XLSX.write(book, { type: 'array', bookType: 'xlsx' }), catalogs, [supplier])
    expect(row.errors).toEqual([])
    expect(row.state.lines[0]).toMatchObject({ code: '', description: 'Servicio', quantity: '2', unitValue: '100', discount: '10', taxChargeId: 'iva19' })
  })
  it('sigue leyendo plantillas anteriores con producto y nota del ítem', () => {
    const headers = [...SUPPORT_EXCEL_COLUMNS, 'Nota del ítem']
    const oldRow = ['DOC-001', '2026-11-07', 'NIT', supplier.document_number, '000123', 'Servicio', 2, 100, 'Efectivo', '', 10, 19, 0, 0, 0, 'Observación general', 'Detalle anterior']
    const book = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([headers, oldRow]), 'Documentos soporte')
    const [row] = readSupportDocumentsWorkbook(XLSX.write(book, { type: 'array', bookType: 'xlsx' }), catalogs, [supplier])
    expect(row.errors).toEqual([])
    expect(row.state.notes).toBe('Observación general')
    expect(row.state.lines[0]).toMatchObject({ code: '000123', description: 'Servicio', notes: 'Detalle anterior' })
  })
  it('construye un documento editable con el proveedor guardado y el importe del pago', () => {
    const [row] = read([line()])
    expect(row.status).toBe('ready')
    expect(row.identification).toBe('001234567')
    expect(row.state).toMatchObject({ selectedCustomer: { id: 'supplier', name: 'Proveedor' }, issueDate: '2026-11-07', dueDate: '2026-11-07', documentTotal: 200, currency: 'COP', discountIsPercent: false, paymentFormId: '1', paymentEntries: [{ id: 'payment-1', methodId: 'cash', amount: '200', automatic: true }] })
    expect(row.state.lines[0]).toMatchObject({ description: 'Servicio', quantity: '2', unitValue: '100', priceOptions: [], selectedPriceId: '', taxChargeId: '', taxRetentionId: '' })
  })
  it('usa COP en plantillas anteriores con moneda y conserva descuentos e impuestos', () => {
    expect(read([line({ 9: 'USD' })])[0].state.currency).toBe('COP')
    const book = XLSX.utils.book_new()
    const headers = LEGACY_SUPPORT_EXCEL_COLUMNS.filter(header => header !== 'Código producto')
      .map(header => header === 'Referencia *' ? 'Grupo de documento *' : header)
    const oldRow = Array.from(line({ 9: 'USD', 11: 10, 12: 19 })).filter((_, column) => column !== 10)
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([headers, oldRow]), 'Documentos soporte')
    const [row] = readSupportDocumentsWorkbook(XLSX.write(book, { type: 'array', bookType: 'xlsx' }), catalogs, [supplier])
    expect(row.errors).toEqual([])
    expect(row.state.currency).toBe('COP')
    expect(row.state.lines[0]).toMatchObject({ discount: '10', taxChargeId: 'iva19' })
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
    { changes: { 8: '2026-01-01' } }, { changes: { 11: 201 } },
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
