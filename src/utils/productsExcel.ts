import { styleExcelTemplate } from './excelTemplateStyle'
import * as XLSX from 'xlsx'
import { PRODUCT_DESCRIPTION_MAX_LENGTH, PRODUCT_KIND_OPTIONS } from '../constants/createProduct'
import type { CreateProductRequest, ProductCategoryResponse, ProductResponse, UnitMeasure } from '../services/productService'
import type { JarvisTax } from '../types/jarvis'
import { DEFAULT_PRODUCT_IVA_ID } from './productTaxes'
import { writeExcelTemplate, type ExcelTemplateValidation } from './excelTemplateValidation'

export const PRODUCTS_IMPORT_LIMIT = 1000
export const PRODUCTS_IMPORT_MAX_BYTES = 5 * 1024 * 1024
export const PRODUCTS_TEMPLATE_FILENAME = 'plantilla-productos-jarvis.xlsx'
export const DEFAULT_IVA_EXCEL_CODE = 'IVA19'
export const LEGACY_PRODUCTS_EXCEL_COLUMNS = [
  'Código / SKU *', 'Nombre *', 'Tipo *', 'Unidad DIAN *', 'Precio de venta *',
  'Categoría', 'Descripción', 'Impuestos (códigos)', 'Precio incluye IVA',
  'Nombre precio 1', 'Precio 1 activo', 'Precio 2', 'Nombre precio 2', 'Precio 2 activo',
  'Precio 3', 'Nombre precio 3', 'Precio 3 activo',
] as const
export const PRODUCTS_EXCEL_COLUMNS = [
  'Código / SKU *', 'Nombre *', 'Tipo *', 'Unidad DIAN *', 'Precio de venta *',
  'Categoría', 'Descripción', 'Impuesto 1', 'Impuesto 2', 'Impuesto 3', 'Precio incluye IVA',
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

const unitLabel = (unit: UnitMeasure) => `${unit.code} — ${unit.name}`
function productTaxChoices(catalogs?: ProductsImportCatalogs): Array<{ value: string; code: string }> {
  const active = catalogs?.taxes.filter(tax => tax.is_active && tax.code.trim()) ?? []
  return [...active.filter(tax => productImportKey(tax.code) !== DEFAULT_IVA_EXCEL_CODE
    && active.filter(other => productImportKey(other.code) === productImportKey(tax.code)).length === 1)
    .map(tax => ({ code: tax.code, value: `${tax.code} — ${tax.name}${tax.rate == null ? '' : ` (${tax.rate} %)`}` })),
  { code: DEFAULT_IVA_EXCEL_CODE, value: `${DEFAULT_IVA_EXCEL_CODE} — IVA predeterminado (19 %)` }]
}

function buildProductsTemplate(catalogs?: ProductsImportCatalogs): { book: XLSX.WorkBook; validations: ExcelTemplateValidation[] } {
  const book = XLSX.utils.book_new()
  const sheet = XLSX.utils.aoa_to_sheet([[...PRODUCTS_EXCEL_COLUMNS]])
  const columns = PRODUCTS_EXCEL_COLUMNS
  const validations: ExcelTemplateValidation[] = []
  const help: Record<typeof columns[number], string> = {
    'Código / SKU *': 'Código único del producto. Conserva el formato Texto para mantener los ceros iniciales.',
    'Nombre *': 'Nombre del producto o servicio.',
    'Tipo *': 'Selecciona Producto o Servicio.',
    'Unidad DIAN *': 'Selecciona la unidad de medida DIAN.',
    'Precio de venta *': 'Precio mayor que cero, con hasta dos decimales, sin símbolos ni separadores de miles.',
    'Categoría': 'Opcional. Selecciona una categoría de tu empresa.',
    'Descripción': `Opcional. Hasta ${PRODUCT_DESCRIPTION_MAX_LENGTH} caracteres.`,
    'Impuesto 1': 'Opcional. Selecciona un impuesto o retención de tu empresa.',
    'Impuesto 2': 'Opcional. Selecciona otro impuesto o retención. No repitas el mismo impuesto.',
    'Impuesto 3': 'Opcional. Selecciona otro impuesto o retención. No repitas el mismo impuesto.',
    'Precio incluye IVA': 'Selecciona Sí si el precio ya incluye IVA. En blanco equivale a No; este campo no agrega impuestos.',
  }
  for (let r = 1; r <= PRODUCTS_IMPORT_LIMIT; r++) {
    for (let c = 0; c < columns.length; c++) {
      sheet[XLSX.utils.encode_cell({ r, c })] = { t: 's', v: '', z: c === 4 ? '0.00' : '@' }
    }
  }
  sheet['!autofilter'] = { ref: `A1:${XLSX.utils.encode_col(columns.length - 1)}${PRODUCTS_IMPORT_LIMIT + 1}` }
  sheet['!cols'] = columns.map(() => ({ wch: 25 }))
  columns.forEach((header, column) => {
    const cell = sheet[XLSX.utils.encode_cell({ r: 0, c: column })]
    cell.c = [{ a: 'Jarvis', t: help[header] }]
    cell.c.hidden = true
  })
  book.Workbook = { Names: [] }
  let catalogColumn = columns.length
  let lastRow = PRODUCTS_IMPORT_LIMIT + 1
  const listRanges = new Map<string, string>()
  const addList = (header: typeof columns[number], name: string, options: string[]) => {
    if (!listRanges.has(name)) {
      const c = catalogColumn++, letter = XLSX.utils.encode_col(c)
      const unique = [...new Set(options)]
      lastRow = Math.max(lastRow, unique.length + 1)
      sheet['!cols']![c] = { hidden: true }
      unique.forEach((value, r) => { sheet[XLSX.utils.encode_cell({ r: r + 1, c })] = { t: 's', v: value, z: '@' } })
      const reference = `'Productos'!$${letter}$2:$${letter}$${Math.max(2, unique.length + 1)}`
      book.Workbook!.Names!.push({ Name: name, Ref: reference })
      listRanges.set(name, reference)
    }
    validations.push({ column: columns.indexOf(header), type: 'list', formula1: name, optional: !header.endsWith('*'), prompt: help[header] })
  }
  addList('Tipo *', 'TiposProducto', PRODUCT_KIND_OPTIONS.map(item => item.label))
  addList('Unidad DIAN *', 'UnidadesProducto', (catalogs?.units ?? [{ code: '94', name: 'Unidad' }]).map(unitLabel))
  const categories = catalogs?.categories.filter(category => catalogs.categories.filter(other => normalize(other.name) === normalize(category.name)).length === 1) ?? []
  addList('Categoría', 'CategoriasProducto', categories.map(category => category.name))
  for (const header of ['Impuesto 1', 'Impuesto 2', 'Impuesto 3'] as const) addList(header, 'ImpuestosProducto', productTaxChoices(catalogs).map(tax => tax.value))
  addList('Precio incluye IVA', 'BooleanosProducto', ['Sí', 'No'])
  validations.push(
    { column: 0, type: 'custom', formula1: 'AND(ISTEXT(A2),LEN(TRIM(A2))>0)', prompt: help['Código / SKU *'] },
    { column: 1, type: 'custom', formula1: 'LEN(TRIM(B2))>0', prompt: help['Nombre *'] },
    { column: 4, type: 'custom', formula1: 'AND(ISNUMBER(E2),E2>0,ROUND(E2,2)=E2)', prompt: help['Precio de venta *'] },
    { column: 6, type: 'textLength', operator: 'between', formula1: '0', formula2: String(PRODUCT_DESCRIPTION_MAX_LENGTH), optional: true, prompt: help['Descripción'] },
  )
  sheet['!ref'] = `A1:${XLSX.utils.encode_col(catalogColumn - 1)}${lastRow}`
  XLSX.utils.book_append_sheet(book, sheet, 'Productos')
  return { book: styleExcelTemplate(book), validations }
}

export function createProductsTemplate(catalogs?: ProductsImportCatalogs): XLSX.WorkBook {
  return buildProductsTemplate(catalogs).book
}

export function createProductsTemplateFile(catalogs?: ProductsImportCatalogs): ArrayBuffer {
  const { book, validations } = buildProductsTemplate(catalogs)
  return writeExcelTemplate(book, validations, PRODUCTS_IMPORT_LIMIT)
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
  try { book = XLSX.read(buffer, { type: 'array', cellFormula: true, cellStyles: true }) }
  catch { throw new Error('No pudimos leer el Excel. Descarga la plantilla de productos y vuelve a intentarlo.') }
  const sheet = book.Sheets.Productos
  if (!sheet?.['!ref']) throw new Error('El archivo debe contener la hoja Productos de la plantilla.')
  const range = XLSX.utils.decode_range(sheet['!ref'])
  const modern = sheet.H1?.v === 'Impuesto 1'
  const columns: readonly string[] = modern ? PRODUCTS_EXCEL_COLUMNS : LEGACY_PRODUCTS_EXCEL_COLUMNS
  if (range.e.r > 10000 || range.e.c >= columns.length + (modern ? 5 : 0)) throw new Error('El archivo no tiene el formato de la plantilla de productos.')
  if (Array.from({ length: Math.max(0, range.e.c + 1 - columns.length) }, (_, index) => index + columns.length).some(column => !sheet['!cols']?.[column]?.hidden)) throw new Error('El archivo no tiene el formato de la plantilla de productos.')
  if (columns.some((header, c) => sheet[XLSX.utils.encode_cell({ r: 0, c })]?.v !== header)) {
    throw new Error('Los encabezados no coinciden con la plantilla de productos. Conserva las columnas y su orden.')
  }
  const existingKeys = new Set(existing.map(item => productImportKey(item.sku)))
  const fileKeys = new Set<string>()
  const rows: ProductImportRow[] = []
  const taxCodeByLabel = new Map(productTaxChoices(catalogs).map(tax => [tax.value, tax.code]))
  for (let r = 1; r <= range.e.r; r++) {
    const sourceCells = columns.map((_, c) => sheet[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined)
    if (!sourceCells.some(cell => cell?.f || String(cell?.v ?? '').trim())) continue
    if (rows.length >= PRODUCTS_IMPORT_LIMIT) throw new Error('El archivo admite máximo 1.000 productos.')
    const cells = LEGACY_PRODUCTS_EXCEL_COLUMNS.map(header => sourceCells[columns.indexOf(header)])
    const values = cells.map(cell => String(cell?.v ?? '').trim())
    const [sku, name, kindText, unitValue, , categoryName, description, taxCodes, includesIva] = values
    const unit = catalogs.units.find(item => item.code === unitValue || unitLabel(item) === unitValue)?.code ?? unitValue
    const selectedTaxes = modern ? ['Impuesto 1', 'Impuesto 2', 'Impuesto 3'].map(header => String(sourceCells[columns.indexOf(header)]?.v ?? '').trim()) : taxCodes.split(';')
    const errors: string[] = []
    if (sourceCells.some(cell => cell?.f || cell?.t === 'e')) errors.push('Usa valores de texto o números, sin fórmulas ni errores de Excel.')
    if (cells[0]?.t === 'n' && (typeof cells[0].v !== 'number' || !Number.isSafeInteger(cells[0].v) || Math.abs(cells[0].v) >= 1e15)) errors.push('Conserva el SKU como texto para evitar pérdida de dígitos.')
    if (!sku) errors.push('El código / SKU es obligatorio.')
    if (!name) errors.push('El nombre es obligatorio.')
    const kind = PRODUCT_KIND_OPTIONS.find(item => normalize(item.label) === normalize(kindText) || item.value === normalize(kindText))?.value
    if (!kind) errors.push('El tipo es obligatorio: Producto o Servicio.')
    if (!unit || !catalogs.units.some(item => item.code === unit)) errors.push('Selecciona una unidad de medida DIAN válida.')
    const categories = catalogs.categories.filter(item => normalize(item.name) === normalize(categoryName))
    if (categoryName && categories.length !== 1) errors.push('La categoría no existe o es ambigua. Selecciona una categoría válida.')
    if (description.length > PRODUCT_DESCRIPTION_MAX_LENGTH) errors.push(`La descripción admite máximo ${PRODUCT_DESCRIPTION_MAX_LENGTH} caracteres.`)
    const taxIds: string[] = []
    for (const code of [...new Set(selectedTaxes.map(value => productImportKey(taxCodeByLabel.get(value) ?? value)).filter(Boolean))]) {
      if (code === DEFAULT_IVA_EXCEL_CODE) { taxIds.push(DEFAULT_PRODUCT_IVA_ID); continue }
      const matches = catalogs.taxes.filter(item => item.is_active && productImportKey(item.code) === code)
      if (matches.length !== 1) errors.push(`Impuesto ${code} desconocido, inactivo o ambiguo. Selecciona un impuesto válido.`)
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
