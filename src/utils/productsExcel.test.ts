import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import type { JarvisTax } from '../types/jarvis'
import { DEFAULT_PRODUCT_IVA_ID } from './productTaxes'
import { createProductsTemplate, PRODUCTS_EXCEL_COLUMNS, readProductsWorkbook, type ProductsImportCatalogs } from './productsExcel'

const tax = { id: 'tax-5', code: '1', name: 'IVA 5%', tax_type: 'IVA', rate: 5, category: 'IMPUESTO', is_active: true } as JarvisTax
const catalogs: ProductsImportCatalogs = { units: [{ code: '94', name: 'Unidad' }, { code: 'KGM', name: 'Kilogramo' }], categories: [{ id: 'cat', name: 'Alimentos' }], taxes: [tax, { ...tax, id: 'inactive', code: '2', is_active: false }] }
function workbook(rows: unknown[][], edit?: (sheet: XLSX.WorkSheet) => void) {
  const book = createProductsTemplate(catalogs)
  XLSX.utils.sheet_add_aoa(book.Sheets.Productos, rows, { origin: 'A2' })
  edit?.(book.Sheets.Productos)
  return XLSX.write(book, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
}
const read = (rows: unknown[][]) => readProductsWorkbook(workbook(rows), catalogs, [])

describe('Excel de productos Jarvis', () => {
  it('genera una plantilla vacía con cinco obligatorios, formato de texto e instrucciones', () => {
    const book = XLSX.read(workbook([]), { type: 'array', cellNF: true })
    expect(book.SheetNames).toEqual(['Productos', 'Instrucciones', 'Tipos', 'Unidades DIAN', 'Categorías', 'Impuestos'])
    expect(PRODUCTS_EXCEL_COLUMNS.filter(column => column.endsWith('*'))).toHaveLength(5)
    expect(book.Sheets.Productos.A2.z).toBe('@')
    expect(book.Sheets.Productos.A1001.z).toBe('@')
    expect(XLSX.utils.sheet_to_json(book.Sheets.Impuestos)).toHaveLength(2)
    expect(() => read([])).toThrow('está vacía')
  })
  it('importa productos y servicios preservando SKU y valores por defecto', () => {
    const rows = read([['000123', 'Producto', 'Producto', '94', '1250,50'], ['SERV-1', 'Servicio', 'service', '94', 2000]])
    expect(rows.map(row => row.status)).toEqual(['ready', 'ready'])
    expect(rows[0].payload).toEqual({ sku: '000123', name: 'Producto', kind: 'product', unit: '94', categoryId: null, description: null, taxIds: [], priceIncludesIva: false, priceLists: [{ position: 1, name: 'Precio general', price: 1250.5, enabled: true }] })
    expect(rows[1].payload?.kind).toBe('service')
  })
  it('mapea categoría e impuestos y guarda tres precios con sus nombres y estados', () => {
    const [row] = read([['A1', 'Artículo', 'Producto', 'KGM', 1250.5, 'Alimentos', 'Descripción', '1;IVA19;1', 'Sí', 'General', 'No', '1000.25', 'Mayorista', 'Sí', '900,50', '', 'No']])
    expect(row.errors).toEqual([])
    expect(row.payload).toMatchObject({ categoryId: 'cat', description: 'Descripción', taxIds: ['tax-5', DEFAULT_PRODUCT_IVA_ID], priceIncludesIva: true, priceLists: [{ position: 1, name: 'General', price: 1250.5, enabled: false }, { position: 2, name: 'Mayorista', price: 1000.25, enabled: true }, { position: 3, name: 'Precio 3', price: 900.5, enabled: false }] })
  })
  it.each(['1250.50', '1250,50', 1250.5])('interpreta el precio %s sin perder decimales', value => {
    expect(read([['A1', 'Producto', 'Producto', '94', value]])[0].payload?.priceLists[0].price).toBe(1250.5)
  })
  it.each(['1.250', '1,250', '1.250,50', '$1250', 'abc', 0, -1, 1.001])('rechaza precios ambiguos o inválidos: %s', value => {
    const [row] = read([['A1', 'Producto', 'Producto', '94', value]])
    expect(row.status).toBe('invalid')
    expect(row.payload).toBeUndefined()
  })
  it.each([
    { data: ['', 'Producto', 'Producto', '94', 100] },
    { data: ['A1', '', 'Producto', '94', 100] },
    { data: ['A1', 'Producto', '', '94', 100] },
    { data: ['A1', 'Producto', 'Otro', '94', 100] },
    { data: ['A1', 'Producto', 'Producto', 'UNKNOWN', 100] },
    { data: ['A1', 'Producto', 'Producto', '94', ''] },
    { data: ['A1', 'Producto', 'Producto', '94', 100, 'Desconocida'] },
    { data: ['A1', 'Producto', 'Producto', '94', 100, '', 'a'.repeat(501)] },
    { data: ['A1', 'Producto', 'Producto', '94', 100, '', '', '2'] },
    { data: ['A1', 'Producto', 'Producto', '94', 100, '', '', '', 'Tal vez'] },
    { data: ['A1', 'Producto', 'Producto', '94', 100, '', '', '', '', '', 'No'] },
    { data: ['A1', 'Producto', 'Producto', '94', 100, '', '', '', '', '', '', '', 'Nombre sin precio'] },
    { data: ['A1', 'Producto', 'Producto', '94', 100, '', '', '', '', '', '', '', '', '', 50] },
  ])('rechaza campos o listas inválidos: $data', ({ data }) => {
    const [row] = read([data])
    expect(row.errors.length).toBeGreaterThan(0)
    expect(row.payload).toBeUndefined()
  })
  it('detecta duplicados por SKU en el Excel y en Jarvis, conservando las filas originales', () => {
    const rows = readProductsWorkbook(workbook([['A1', 'Uno', 'Producto', '94', 100], [], ['a1', 'Repetido', 'Producto', '94', 100], ['EXISTE', 'Otro', 'Servicio', '94', 100]]), catalogs, [{ sku: 'existe' }])
    expect(rows.map(row => [row.row, row.status])).toEqual([[2, 'ready'], [4, 'duplicate'], [5, 'duplicate']])
    expect(read([['A1', '', 'Producto', '94', 100], ['A1', 'Válido', 'Producto', '94', 100]])[1].status).toBe('ready')
  })
  it('rechaza fórmulas y SKU numéricos que Excel pudo redondear', () => {
    const buffer = workbook([['A1', 'Producto', 'Producto', '94', 100]], sheet => { sheet.E2 = { t: 'n', v: 100, f: '50+50' } })
    expect(readProductsWorkbook(buffer, catalogs, [])[0].status).toBe('invalid')
    expect(read([[1234567890123456, 'Producto', 'Producto', '94', 100]])[0].status).toBe('invalid')
    expect(read([['001234567890123456789', 'Producto', 'Producto', '94', 100]])[0].payload?.sku).toBe('001234567890123456789')
  })
  it('valida hoja, encabezados y columnas de la plantilla', () => {
    expect(() => readProductsWorkbook(workbook([], sheet => { sheet.A1.v = 'Otro' }), catalogs, [])).toThrow('encabezados')
    expect(() => readProductsWorkbook(workbook([], sheet => { sheet['!ref'] = 'A1:R1001' }), catalogs, [])).toThrow('formato')
    const book = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['No es la plantilla']]), 'Otra')
    expect(() => readProductsWorkbook(XLSX.write(book, { type: 'array', bookType: 'xlsx' }), catalogs, [])).toThrow('hoja Productos')
  })
  it('admite 1.000 productos y rechaza el exceso de filas', () => {
    const data = Array.from({ length: 1000 }, (_, i) => [`P${i}`, 'Producto', 'Producto', '94', 100])
    expect(read(data)).toHaveLength(1000)
    expect(() => read([...data, ['EXTRA', 'Otro', 'Producto', '94', 100]])).toThrow('máximo 1.000')
  })
})
