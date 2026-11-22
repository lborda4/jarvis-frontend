import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import * as CFB from 'cfb'
import type { JarvisTax } from '../types/jarvis'
import { DEFAULT_PRODUCT_IVA_ID } from './productTaxes'
import { createProductsTemplate, createProductsTemplateFile, LEGACY_PRODUCTS_EXCEL_COLUMNS, PRODUCTS_EXCEL_COLUMNS, readProductsWorkbook, type ProductsImportCatalogs } from './productsExcel'

const tax = { id: 'tax-5', code: '1', name: 'IVA 5%', tax_type: 'IVA', rate: 5, category: 'IMPUESTO', is_active: true } as JarvisTax
const catalogs: ProductsImportCatalogs = { units: [{ code: '94', name: 'Unidad' }, { code: 'KGM', name: 'Kilogramo' }], categories: [{ id: 'cat', name: 'Alimentos' }], taxes: [tax, { ...tax, id: 'inactive', code: '2', is_active: false }] }
function workbook(rows: unknown[][], edit?: (sheet: XLSX.WorkSheet) => void) {
  const book = XLSX.utils.book_new()
  const sheet = XLSX.utils.aoa_to_sheet([[...LEGACY_PRODUCTS_EXCEL_COLUMNS]])
  for (let r = 1; r <= 1000; r++) for (let c = 0; c < LEGACY_PRODUCTS_EXCEL_COLUMNS.length; c++) sheet[XLSX.utils.encode_cell({ r, c })] = { t: 's', v: '', z: '@' }
  sheet['!ref'] = 'A1:Q1001'
  XLSX.utils.book_append_sheet(book, sheet, 'Productos')
  XLSX.utils.sheet_add_aoa(book.Sheets.Productos, rows, { origin: 'A2' })
  edit?.(book.Sheets.Productos)
  return XLSX.write(book, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
}
const read = (rows: unknown[][]) => readProductsWorkbook(workbook(rows), catalogs, [])
function modernWorkbook(rows: unknown[][], edit?: (sheet: XLSX.WorkSheet) => void) {
  const book = createProductsTemplate(catalogs)
  XLSX.utils.sheet_add_aoa(book.Sheets.Productos, rows, { origin: 'A2' })
  edit?.(book.Sheets.Productos)
  return XLSX.write(book, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
}

describe('Excel de productos Jarvis', () => {
  it('genera una sola hoja con cinco obligatorios y catálogos ocultos', () => {
    const buffer = createProductsTemplateFile(catalogs)
    const book = XLSX.read(buffer, { type: 'array', cellNF: true, cellStyles: true })
    expect(book.SheetNames).toEqual(['Productos'])
    expect(PRODUCTS_EXCEL_COLUMNS.filter(column => column.endsWith('*'))).toHaveLength(5)
    expect(book.Sheets.Productos.A2.z).toBe('@')
    expect(book.Sheets.Productos.A1001.z).toBe('@')
    expect(book.Sheets.Productos.E2.z).toBe('0.00')
    expect(book.Sheets.Productos.M2.v).toBe('94 — Unidad')
    expect(book.Sheets.Productos.N2.v).toBe('Alimentos')
    expect(book.Sheets.Productos.O2.v).toBe('1 — IVA 5% (5 %)')
    expect(book.Sheets.Productos.O3.v).toBe('IVA19 — IVA predeterminado (19 %)')
    expect(book.Sheets.Productos.P2.v).toBe('Sí')
    expect(book.Sheets.Productos.P3.v).toBe('No')
    expect(book.Sheets.Productos['!cols']?.slice(11, 16).every(column => column.hidden)).toBe(true)
    expect(() => readProductsWorkbook(buffer, catalogs, [])).toThrow('está vacía')
  })
  it('incluye desplegables y validaciones en el archivo descargable, con la cabecera congelada', () => {
    const buffer = createProductsTemplateFile(catalogs)
    const archive = CFB.read(new Uint8Array(buffer), { type: 'buffer' })
    const xml = new TextDecoder().decode(new Uint8Array(CFB.find(archive, '/xl/worksheets/sheet1.xml')!.content))
    for (const name of ['TiposProducto', 'UnidadesProducto', 'CategoriasProducto', 'ImpuestosProducto', 'BooleanosProducto']) expect(xml).toContain(`<formula1>${name}</formula1>`)
    for (const column of ['C', 'D', 'F', 'H', 'I', 'J', 'K']) expect(xml).toContain(`sqref="${column}2:${column}1001"`)
    expect(xml).toContain('errorStyle="stop"')
    expect(xml).toContain('AND(ISNUMBER(E2),E2&gt;0,ROUND(E2,2)=E2)')
    expect(xml).toContain('topLeftCell="A2"')
    expect(xml).toContain('state="frozen"')
  })
  it('importa las opciones legibles de los desplegables y conserva ceros, decimales e impuestos', () => {
    const input = modernWorkbook([['000123', 'Producto', 'Producto', '94 — Unidad', 1250.5, 'Alimentos', 'Descripción',
      '1 — IVA 5% (5 %)', 'IVA19 — IVA predeterminado (19 %)', '1 — IVA 5% (5 %)', 'Sí']])
    const [row] = readProductsWorkbook(input, catalogs, [])
    expect(row.errors).toEqual([])
    expect(row.payload).toMatchObject({ sku: '000123', unit: '94', categoryId: 'cat', description: 'Descripción',
      taxIds: ['tax-5', DEFAULT_PRODUCT_IVA_ID], priceIncludesIva: true, priceLists: [{ position: 1, name: 'Precio general', price: 1250.5, enabled: true }] })
  })
  it('admite códigos pegados directamente y productos sin categoría ni impuestos', () => {
    const input = modernWorkbook([['SERV-1', 'Servicio', 'Servicio', '94', '2000,25'],
      ['PROD-2', 'Producto', 'Producto', 'KGM', 3000, '', '', '1', 'IVA19', '', 'No']])
    const rows = readProductsWorkbook(input, catalogs, [])
    expect(rows.every(row => row.status === 'ready')).toBe(true)
    expect(rows[0].payload).toMatchObject({ kind: 'service', unit: '94', categoryId: null, taxIds: [], priceIncludesIva: false })
    expect(rows[1].payload?.taxIds).toEqual(['tax-5', DEFAULT_PRODUCT_IVA_ID])
  })
  it('rechaza valores ajenos al catálogo y fórmulas pegadas en los impuestos de la plantilla nueva', () => {
    const input = modernWorkbook([['A', 'Producto', 'Producto', 'No existe', 100, 'Categoría ajena', '', 'Impuesto ajeno'],
      ['B', 'Producto', 'Producto', '94', 100]], sheet => { sheet.I3 = { t: 'n', v: 1, f: '1' } })
    const rows = readProductsWorkbook(input, catalogs, [])
    expect(rows.every(row => row.status === 'invalid')).toBe(true)
    expect(rows[0].errors).toHaveLength(3)
    expect(rows[1].errors.some(error => error.includes('fórmulas'))).toBe(true)
  })
  it('no confunde los catálogos ocultos con productos y rechaza columnas adicionales visibles', () => {
    const input = modernWorkbook([['A', 'Producto', 'Producto', '94', 100]])
    expect(readProductsWorkbook(input, catalogs, [])).toHaveLength(1)
    const visibleCatalog = modernWorkbook([['A', 'Producto', 'Producto', '94', 100]], sheet => { sheet['!cols']![11].hidden = false })
    expect(() => readProductsWorkbook(visibleCatalog, catalogs, [])).toThrow('formato')
  })
  it('admite el catálogo DIAN de más de 1.000 unidades sin contarlo como productos', () => {
    const largeCatalogs = { ...catalogs, units: Array.from({ length: 1093 }, (_, index) => ({ code: `U${index}`, name: `Unidad ${index}` })) }
    const book = createProductsTemplate(largeCatalogs)
    XLSX.utils.sheet_add_aoa(book.Sheets.Productos, [['001', 'Producto', 'Producto', 'U1092 — Unidad 1092', 100]], { origin: 'A2' })
    const input = XLSX.write(book, { type: 'array', bookType: 'xlsx' })
    const rows = readProductsWorkbook(input, largeCatalogs, [])
    expect(rows).toHaveLength(1)
    expect(rows[0].payload?.unit).toBe('U1092')
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
