import * as XLSX from 'xlsx'
import { PRODUCT_DESCRIPTION_MAX_LENGTH, PRODUCT_KIND_OPTIONS } from '../constants/createProduct'
import type { CreateProductRequest, ProductCategoryResponse, ProductResponse, UnitMeasure } from '../services/productService'
import type { JarvisTax } from '../types/jarvis'
import { DEFAULT_PRODUCT_IVA_ID } from './productTaxes'

export const PRODUCTS_IMPORT_LIMIT = 1000
export const PRODUCTS_IMPORT_MAX_BYTES = 5 * 1024 * 1024
export const PRODUCTS_TEMPLATE_FILENAME = 'plantilla-productos-jarvis.xlsx'
export const DEFAULT_IVA_EXCEL_CODE = 'IVA19'
export const PRODUCTS_EXCEL_COLUMNS = [
  'Código / SKU *', 'Nombre *', 'Tipo *', 'Unidad DIAN *', 'Precio de venta *',
  'Categoría', 'Descripción', 'Impuestos (códigos)', 'Precio incluye IVA',
  'Nombre precio 1', 'Precio 1 activo', 'Precio 2', 'Nombre precio 2', 'Precio 2 activo',
  'Precio 3', 'Nombre precio 3', 'Precio 3 activo',
] as const

export interface ProductsImportCatalogs {
  units: UnitMeasure[]
  categories: ProductCategoryResponse[]
  taxes: JarvisTax[]
}
export interface ProductImportRow {
  row: number
  sku: string
  name: string
  errors: string[]
  status: 'ready' | 'invalid' | 'duplicate' | 'saved' | 'failed'
  payload?: CreateProductRequest
  message?: string
}
const normalize = (value: string) => value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
export const productImportKey = (sku: string) => sku.trim().toUpperCase()

export function createProductsTemplate(catalogs?: ProductsImportCatalogs): XLSX.WorkBook {
  const book = XLSX.utils.book_new()
  const sheet = XLSX.utils.aoa_to_sheet([[...PRODUCTS_EXCEL_COLUMNS]])
  for (let r = 1; r <= PRODUCTS_IMPORT_LIMIT; r++) {
    for (let c = 0; c < PRODUCTS_EXCEL_COLUMNS.length; c++) {
      sheet[XLSX.utils.encode_cell({ r, c })] = { t: 's', v: '', z: '@' }
    }
  }
  const last = XLSX.utils.encode_col(PRODUCTS_EXCEL_COLUMNS.length - 1)
  sheet['!ref'] = `A1:${last}${PRODUCTS_IMPORT_LIMIT + 1}`
  sheet['!autofilter'] = { ref: sheet['!ref'] }
  sheet['!cols'] = PRODUCTS_EXCEL_COLUMNS.map((_, c) => ({ wch: c === 1 || c === 6 ? 45 : 25 }))
  XLSX.utils.book_append_sheet(book, sheet, 'Productos')
  const addSheet = (name: string, rows: (string | number)[][], widths: number[]) => {
    const reference = XLSX.utils.aoa_to_sheet(rows)
    reference['!cols'] = widths.map(wch => ({ wch }))
    XLSX.utils.book_append_sheet(book, reference, name)
  }
  addSheet('Instrucciones', [
    ['Plantilla de productos Jarvis', 'Instrucciones'],
    ['Cómo llenar', 'Un producto o servicio por fila en Productos, desde la fila 2. Conserva la hoja y los encabezados.'],
    ['Obligatorios (*)', 'Código / SKU, nombre, tipo, unidad DIAN y precio de venta. Las demás columnas son opcionales.'],
    ['Código / SKU', 'Escribe un código único. Conserva el formato Texto para no perder ceros iniciales. La carga utiliza este código tal como lo escribes.'],
    ['Tipo', 'Producto o Servicio. También se aceptan product y service.'],
    ['Unidad DIAN', 'Usa un código de la hoja Unidades DIAN. Por ejemplo, 94 corresponde a Unidad.'],
    ['Precios', 'Mayores a cero. Usa números de Excel o texto sin separadores de miles ni símbolos: 1250,50 o 1250.50. Máximo dos decimales.'],
    ['Categoría', 'Usa el nombre exacto de una categoría existente, de la hoja Categorías descargada desde Jarvis. Vacío significa sin categoría.'],
    ['Descripción', `Opcional, máximo ${PRODUCT_DESCRIPTION_MAX_LENGTH} caracteres.`],
    ['Impuestos (códigos)', `Separa los códigos de la hoja Impuestos con punto y coma. ${DEFAULT_IVA_EXCEL_CODE} selecciona el IVA predeterminado del 19 %. Vacío significa sin impuestos.`],
    ['Precio incluye IVA', 'Sí o No. Si está vacío se usa No. Esta columna no agrega impuestos por sí sola.'],
    ['Listas de precios', 'El precio de venta corresponde al precio 1. Puedes agregar precio 2 y precio 3, en ese orden.'],
    ['Nombres de precios', 'Si están vacíos se usan Precio general, Precio 2 y Precio 3.'],
    ['Precios activos', 'Sí o No. Si están vacíos se usa Sí para los precios completados. Al menos uno debe estar activo.'],
    ['Límites', 'Hasta 1.000 registros por archivo .xlsx o .xls de máximo 5 MB.'],
    ['Revisión y guardado', 'Corrige los errores antes de guardar. Los SKU existentes o repetidos se omiten; no se actualizan productos. Puedes reintentar las filas no guardadas.'],
  ], [28, 115])
  addSheet('Tipos', [['Valor'], ...PRODUCT_KIND_OPTIONS.map(item => [item.label])], [25])
  addSheet('Unidades DIAN', [['Código', 'Nombre'], ...(catalogs?.units ?? [{ code: '94', name: 'Unidad' }]).map(item => [item.code, item.name])], [20, 60])
  addSheet('Categorías', [['Nombre'], ...(catalogs?.categories.map(item => [item.name]) ?? [])], [60])
  addSheet('Impuestos', [['Código para importar', 'Nombre', 'Tipo', 'Tarifa (%)'],
    ...(catalogs?.taxes.filter(item => item.is_active).map(item => [item.code, item.name, item.tax_type, item.rate ?? '']) ?? []),
    [DEFAULT_IVA_EXCEL_CODE, 'IVA predeterminado', 'IVA', 19],
  ], [25, 60, 25, 18])
  return book
}

function parsePrice(cell: XLSX.CellObject | undefined): number {
  const value = cell?.v
  if (typeof value === 'number') return value
  const text = String(value ?? '').trim()
  return /^\d+(?:[.,]\d{1,2})?$/.test(text) ? Number(text.replace(',', '.')) : NaN
}
function parseBoolean(text: string): boolean | undefined {
  if (['si', 'true', '1'].includes(normalize(text))) return true
  if (['no', 'false', '0'].includes(normalize(text))) return false
  return undefined
}

export function readProductsWorkbook(buffer: ArrayBuffer, catalogs: ProductsImportCatalogs, existing: Pick<ProductResponse, 'sku'>[]): ProductImportRow[] {
  let book: XLSX.WorkBook
  try { book = XLSX.read(buffer, { type: 'array', cellFormula: true }) }
  catch { throw new Error('No pudimos leer el Excel. Descarga la plantilla de productos y vuelve a intentarlo.') }
  const sheet = book.Sheets.Productos
  if (!sheet?.['!ref']) throw new Error('El archivo debe contener la hoja Productos de la plantilla.')
  const range = XLSX.utils.decode_range(sheet['!ref'])
  if (range.e.r > 10000 || range.e.c >= PRODUCTS_EXCEL_COLUMNS.length) throw new Error('El archivo no tiene el formato de la plantilla de productos.')
  if (PRODUCTS_EXCEL_COLUMNS.some((header, c) => sheet[XLSX.utils.encode_cell({ r: 0, c })]?.v !== header)) {
    throw new Error('Los encabezados no coinciden con la plantilla de productos. Conserva las columnas y su orden.')
  }
  const existingKeys = new Set(existing.map(item => productImportKey(item.sku)))
  const fileKeys = new Set<string>()
  const rows: ProductImportRow[] = []
  for (let r = 1; r <= range.e.r; r++) {
    const cells = PRODUCTS_EXCEL_COLUMNS.map((_, c) => sheet[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined)
    if (!cells.some(cell => cell?.f || String(cell?.v ?? '').trim())) continue
    if (rows.length >= PRODUCTS_IMPORT_LIMIT) throw new Error('El archivo admite máximo 1.000 productos.')
    const values = cells.map(cell => String(cell?.v ?? '').trim())
    const [sku, name, kindText, unit, , categoryName, description, taxCodes, includesIva] = values
    const errors: string[] = []
    if (cells.some(cell => cell?.f || cell?.t === 'e')) errors.push('Usa valores de texto o números, sin fórmulas ni errores de Excel.')
    if (cells[0]?.t === 'n' && (typeof cells[0].v !== 'number' || !Number.isSafeInteger(cells[0].v) || Math.abs(cells[0].v) >= 1e15)) errors.push('Conserva el SKU como texto para evitar pérdida de dígitos.')
    if (!sku) errors.push('El código / SKU es obligatorio.')
    if (!name) errors.push('El nombre es obligatorio.')
    const kind = PRODUCT_KIND_OPTIONS.find(item => normalize(item.label) === normalize(kindText) || item.value === normalize(kindText))?.value
    if (!kind) errors.push('El tipo es obligatorio: Producto o Servicio.')
    if (!unit || !catalogs.units.some(item => item.code === unit)) errors.push('Usa una unidad de medida de la hoja Unidades DIAN.')
    const categories = catalogs.categories.filter(item => normalize(item.name) === normalize(categoryName))
    if (categoryName && categories.length !== 1) errors.push('La categoría no existe o es ambigua. Usa un nombre único de la hoja Categorías.')
    if (description.length > PRODUCT_DESCRIPTION_MAX_LENGTH) errors.push(`La descripción admite máximo ${PRODUCT_DESCRIPTION_MAX_LENGTH} caracteres.`)
    const taxIds: string[] = []
    for (const code of [...new Set(taxCodes.split(';').map(productImportKey).filter(Boolean))]) {
      if (code === DEFAULT_IVA_EXCEL_CODE) { taxIds.push(DEFAULT_PRODUCT_IVA_ID); continue }
      const matches = catalogs.taxes.filter(item => item.is_active && productImportKey(item.code) === code)
      if (matches.length !== 1) errors.push(`Impuesto ${code} desconocido, inactivo o ambiguo. Consulta la hoja Impuestos.`)
      else taxIds.push(matches[0].id)
    }
    const priceIncludesIva = includesIva ? parseBoolean(includesIva) : false
    if (priceIncludesIva === undefined) errors.push('Precio incluye IVA debe ser Sí o No.')
    const priceLists: CreateProductRequest['priceLists'] = []
    for (const [index, priceColumn] of [4, 11, 14].entries()) {
      const nameColumn = index === 0 ? 9 : priceColumn + 1
      const enabledColumn = index === 0 ? 10 : priceColumn + 2
      if (index > 0 && !values[priceColumn]) {
        if (values[nameColumn] || values[enabledColumn]) errors.push(`Completa el precio ${index + 1} o deja vacíos su nombre y estado.`)
        continue
      }
      if (index === 2 && !values[11]) errors.push('Completa el precio 2 antes de agregar el precio 3.')
      const price = parsePrice(cells[priceColumn])
      if (!Number.isFinite(price) || price <= 0 || !Number.isSafeInteger(Math.round(price * 100)) || Math.abs(price * 100 - Math.round(price * 100)) > 0.0001) errors.push(`El precio ${index + 1} debe ser mayor a 0, con hasta dos decimales y sin separadores de miles.`)
      const enabled = values[enabledColumn] ? parseBoolean(values[enabledColumn]) : true
      if (enabled === undefined) errors.push(`Precio ${index + 1} activo debe ser Sí o No.`)
      priceLists.push({ position: index + 1, name: values[nameColumn] || (index === 0 ? 'Precio general' : `Precio ${index + 1}`), price, enabled: enabled ?? true })
    }
    if (!priceLists.some(item => item.enabled)) errors.push('Activa al menos un precio.')
    const key = productImportKey(sku)
    const duplicate = existingKeys.has(key) ? 'El SKU ya existe en Jarvis.' : fileKeys.has(key) ? 'SKU repetido en el archivo.' : ''
    if (!errors.length) fileKeys.add(key)
    rows.push({ row: r + 1, sku, name, errors, status: errors.length ? 'invalid' : duplicate ? 'duplicate' : 'ready',
      ...(duplicate ? { message: duplicate } : {}),
      ...(!errors.length && kind ? { payload: { sku, name, kind, unit, categoryId: categories[0]?.id ?? null, description: description || null, taxIds: [...new Set(taxIds)], priceIncludesIva, priceLists } } : {}),
    })
  }
  if (!rows.length) throw new Error('La hoja Productos está vacía. Agrega al menos un producto desde la fila 2.')
  return rows
}
