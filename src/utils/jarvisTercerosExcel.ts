import { styleExcelTemplate } from './excelTemplateStyle'
import * as XLSX from 'xlsx'
import {
  JARVIS_DOCUMENT_TYPE_OPTIONS,
  JARVIS_ENTITY_TYPE_OPTIONS,
  JARVIS_TAX_RESPONSIBILITY,
  JARVIS_TAX_RESPONSIBILITY_OPTIONS,
  type CreateJarvisTerceroRequest,
  type JarvisMunicipality,
  type JarvisTercero,
  type JarvisTypeLiability,
  type JarvisTypeRegime,
} from '../types/jarvis'
import { parseCopyEmails } from './copyEmails'
import { entityTypeFromDocumentType } from './jarvisTerceroForm'
import { writeExcelTemplate, type ExcelTemplateValidation } from './excelTemplateValidation'

export const TERCEROS_IMPORT_LIMIT = 1000
export const TERCEROS_IMPORT_MAX_BYTES = 5 * 1024 * 1024
export const TERCEROS_TEMPLATE_FILENAME = 'plantilla-terceros-jarvis.xlsx'
export const LEGACY_TERCEROS_EXCEL_COLUMNS = [
  'Tipo de documento *',
  'Número de documento *',
  'Nombre / razón social *',
  'Dígito de verificación',
  'Persona o empresa',
  'Tipo de responsabilidad',
  'Tipo de régimen',
  'Ciudad (código DANE)',
  'Correo principal',
  'Teléfono',
  'Dirección',
  'Correos adicionales (CC)',
] as const
export const TERCEROS_EXCEL_COLUMNS = [
  'Tipo de documento *', 'Número de documento *', 'Nombre / razón social *',
  'Dígito de verificación', 'Persona o empresa', 'Tipo de responsabilidad',
  'Tipo de régimen', 'Ciudad *', 'Correo principal', 'Teléfono', 'Dirección', 'Correos adicionales (CC)',
] as const

export interface TercerosImportCatalogs {
  municipalities: JarvisMunicipality[]
  liabilities: JarvisTypeLiability[]
  regimes: JarvisTypeRegime[]
}

export interface TerceroImportRow {
  row: number
  documentType: string
  documentNumber: string
  name: string
  errors: string[]
  status: 'ready' | 'invalid' | 'duplicate' | 'saved' | 'failed'
  payload?: CreateJarvisTerceroRequest
  message?: string
}

const normalize = (value: string) => value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
export const terceroImportKey = (type: string, number: string) => `${type.trim().toUpperCase()}:${number.trim().toUpperCase()}`

const liabilityLabel = (item: Pick<JarvisTypeLiability, 'code' | 'name'>) => `${item.code} — ${item.name}`
const cityLabel = (item: JarvisMunicipality) => `${item.code!.padStart(5, '0')} — ${item.name}`

function buildTercerosTemplate(catalogs?: TercerosImportCatalogs): { book: XLSX.WorkBook; validations: ExcelTemplateValidation[] } {
  const book = XLSX.utils.book_new()
  const sheet = XLSX.utils.aoa_to_sheet([[...TERCEROS_EXCEL_COLUMNS]])
  const help = [
    'Selecciona NIT, CC, CE o PA.',
    'Documento sin puntos, espacios, guiones ni dígito de verificación. Conserva el formato Texto.',
    'Nombre de la persona o razón social de la empresa.',
    'Opcional. Un solo dígito para NIT.',
    'Opcional. En blanco se usa Persona jurídica para NIT y Persona natural para los demás documentos.',
    'Opcional. En blanco se usa R-99-PN.',
    'Opcional. En blanco se usa No Responsable de IVA.',
    'Selecciona la ciudad. También puedes escribir su código DANE de cinco dígitos.',
    'Opcional. Correo principal del tercero.',
    'Opcional. Conserva el formato Texto para mantener los ceros iniciales.',
    'Opcional. Dirección del tercero.',
    'Opcional. Hasta diez correos separados por punto y coma.',
  ]
  TERCEROS_EXCEL_COLUMNS.forEach((_, column) => {
    const cell = sheet[XLSX.utils.encode_cell({ r: 0, c: column })]
    cell.c = [{ a: 'Jarvis', t: help[column] }]
    cell.c.hidden = true
  })
  // Preformat entry cells as text to preserve leading zeros and long identification numbers in Excel.
  for (let row = 1; row <= TERCEROS_IMPORT_LIMIT; row++) {
    for (let column = 0; column < TERCEROS_EXCEL_COLUMNS.length; column++) {
      sheet[XLSX.utils.encode_cell({ r: row, c: column })] = { t: 's', v: '', z: '@' }
    }
  }
  sheet['!cols'] = TERCEROS_EXCEL_COLUMNS.map((_, i) => ({ wch: i === 2 || i === 10 || i === 11 ? 40 : 27 }))
  sheet['!autofilter'] = { ref: 'A1:L1001' }
  book.Workbook = { Names: [] }
  const validations: ExcelTemplateValidation[] = []
  let catalogColumn = TERCEROS_EXCEL_COLUMNS.length
  let lastRow = TERCEROS_IMPORT_LIMIT + 1
  const addList = (column: number, name: string, options: string[]) => {
    const c = catalogColumn++, letter = XLSX.utils.encode_col(c)
    const unique = [...new Set(options)]
    lastRow = Math.max(lastRow, unique.length + 1)
    sheet['!cols']![c] = { hidden: true }
    unique.forEach((value, r) => { sheet[XLSX.utils.encode_cell({ r: r + 1, c })] = { t: 's', v: value, z: '@' } })
    book.Workbook!.Names!.push({ Name: name, Ref: `'Terceros'!$${letter}$2:$${letter}$${Math.max(2, unique.length + 1)}` })
    validations.push({ column, type: 'list', formula1: name, optional: !TERCEROS_EXCEL_COLUMNS[column].endsWith('*'), prompt: help[column] })
  }
  addList(0, 'DocumentosTercero', JARVIS_DOCUMENT_TYPE_OPTIONS.map(item => item.value))
  addList(4, 'PersonasTercero', JARVIS_ENTITY_TYPE_OPTIONS.map(item => item.label))
  addList(5, 'ResponsabilidadesTercero', (catalogs?.liabilities ?? JARVIS_TAX_RESPONSIBILITY_OPTIONS.map(item => ({ code: item.value, name: item.label }))).map(liabilityLabel))
  addList(6, 'RegimenesTercero', catalogs?.regimes.map(item => item.name) ?? ['No Responsable de IVA'])
  addList(7, 'CiudadesTercero', catalogs?.municipalities.filter(item => item.code).map(cityLabel) ?? [])
  validations.push(
    { column: 1, type: 'custom', formula1: 'AND(ISTEXT(B2),LEN(TRIM(B2))>0)', prompt: help[1] },
    { column: 2, type: 'custom', formula1: 'LEN(TRIM(C2))>0', prompt: help[2] },
    { column: 3, type: 'custom', formula1: 'AND(LEN(D2)=1,ISNUMBER(IFERROR(VALUE(D2),"")))', optional: true, prompt: help[3] },
  )
  sheet['!ref'] = `A1:${XLSX.utils.encode_col(catalogColumn - 1)}${lastRow}`
  XLSX.utils.book_append_sheet(book, sheet, 'Terceros')
  return { book: styleExcelTemplate(book), validations }
}

export function createTercerosTemplate(catalogs?: TercerosImportCatalogs): XLSX.WorkBook {
  return buildTercerosTemplate(catalogs).book
}

export function createTercerosTemplateFile(catalogs?: TercerosImportCatalogs): ArrayBuffer {
  const { book, validations } = buildTercerosTemplate(catalogs)
  return writeExcelTemplate(book, validations, TERCEROS_IMPORT_LIMIT)
}

export function readTercerosWorkbook(
  buffer: ArrayBuffer,
  catalogs: TercerosImportCatalogs,
  existing: Pick<JarvisTercero, 'document_type' | 'document_number'>[],
): TerceroImportRow[] {
  let book: XLSX.WorkBook
  try { book = XLSX.read(buffer, { type: 'array', cellFormula: true, cellStyles: true }) }
  catch { throw new Error('No pudimos leer el Excel. Descarga la plantilla y vuelve a intentarlo.') }
  const sheet = book.Sheets.Terceros
  if (!sheet?.['!ref']) throw new Error('El archivo debe contener la hoja Terceros de la plantilla.')
  const range = XLSX.utils.decode_range(sheet['!ref'])
  const modern = sheet.H1?.v === 'Ciudad *'
  const columns = modern ? TERCEROS_EXCEL_COLUMNS : LEGACY_TERCEROS_EXCEL_COLUMNS
  // Reject inflated worksheet ranges before traversing any cells.
  if (range.e.r > 10000 || range.e.c >= columns.length + (modern ? 5 : 0)) throw new Error('El archivo no tiene el formato de la plantilla de terceros.')
  if (Array.from({ length: Math.max(0, range.e.c + 1 - columns.length) }, (_, i) => i + columns.length).some(column => !sheet['!cols']?.[column]?.hidden)) throw new Error('El archivo no tiene el formato de la plantilla de terceros.')
  const headers = columns.map((_, c) => sheet[XLSX.utils.encode_cell({ r: 0, c })]?.v)
  if (headers.some((header, i) => header !== columns[i])) {
    throw new Error('Los encabezados no coinciden con la plantilla. Descarga el Excel y conserva sus columnas en el mismo orden.')
  }
  const existingKeys = new Set(existing.map(item => terceroImportKey(item.document_type, item.document_number)))
  const fileKeys = new Set<string>()
  const rows: TerceroImportRow[] = []
  for (let r = 1; r <= range.e.r; r++) {
    const cells = TERCEROS_EXCEL_COLUMNS.map((_, c) => sheet[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined)
    if (!cells.some(cell => cell?.f || String(cell?.v ?? '').trim())) continue
    if (rows.length >= TERCEROS_IMPORT_LIMIT) throw new Error('El archivo admite máximo 1.000 terceros.')
    const values = cells.map(cell => String(cell?.v ?? '').trim())
    const [documentType, documentNumber, name, digit, entity, liability, regime, city, email, phone, address, copies] = values
    const errors: string[] = []
    if (cells.some(cell => cell?.f || cell?.t === 'e')) errors.push('Usa valores de texto, sin fórmulas ni errores de Excel.')
    if (cells.some(cell => cell?.t === 'n' && (typeof cell.v !== 'number' || !Number.isSafeInteger(cell.v) || Math.abs(cell.v) >= 1e15))) errors.push('Conserva documentos, teléfonos y códigos como texto para evitar pérdida de dígitos.')
    const type = JARVIS_DOCUMENT_TYPE_OPTIONS.find(item => item.value === documentType.toUpperCase())?.value
    if (!type) errors.push('Tipo de documento obligatorio: NIT, CC, CE o PA.')
    if (!documentNumber) errors.push('El número de documento es obligatorio.')
    else if (!/^[a-z\d]+$/i.test(documentNumber) || ((type === 'NIT' || type === 'CC') && !/^\d+$/.test(documentNumber))) errors.push('Número de documento sin puntos, espacios, guiones ni dígito de verificación.')
    if (!name) errors.push('El nombre / razón social es obligatorio.')
    if (digit && !/^\d$/.test(digit)) errors.push('El dígito de verificación debe ser un solo número.')
    const entityType = JARVIS_ENTITY_TYPE_OPTIONS.find(item => normalize(item.label) === normalize(entity) || item.value === entity)?.value
    if (entity && !entityType) errors.push('Persona o empresa debe ser Persona natural o Persona jurídica.')
    const taxResponsibility = catalogs.liabilities.find(item => normalize(liabilityLabel(item)) === normalize(liability))?.code
      ?? (liability.toUpperCase() || JARVIS_TAX_RESPONSIBILITY.NOT_APPLICABLE)
    if (liability && !catalogs.liabilities.some(item => item.code.toUpperCase() === taxResponsibility.toUpperCase())) errors.push('Tipo de responsabilidad desconocido. Selecciona una opción de la lista.')
    const typeRegime = catalogs.regimes.find(item => normalize(item.name) === normalize(regime))
    if (regime && !typeRegime) errors.push('Tipo de régimen desconocido. Selecciona una opción de la lista.')
    const cityCode = /^\d{1,5}$/.test(city) ? city.padStart(5, '0') : city
    const municipality = catalogs.municipalities.find(item => item.code && (item.code.padStart(5, '0') === cityCode || normalize(cityLabel(item)) === normalize(city)))
    if (modern && !city) errors.push('La ciudad es obligatoria. Selecciona una opción de la lista.')
    if (city && !municipality) errors.push('Código DANE de ciudad desconocido. Selecciona una ciudad de la lista.')
    if (email && (email.length > 254 || !/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(email))) errors.push('El correo principal no es válido.')
    let copyEmails: string[] = []
    try { copyEmails = parseCopyEmails(copies, email) }
    catch (error) { errors.push(error instanceof Error ? error.message : 'Revisa los correos adicionales.') }
    const key = terceroImportKey(documentType, documentNumber)
    const duplicate = existingKeys.has(key) ? 'El tercero ya existe en Jarvis.' : fileKeys.has(key) ? 'Documento repetido en el archivo.' : ''
    // An invalid first occurrence must not hide a later valid row with the same document.
    if (!errors.length) fileKeys.add(key)
    rows.push({
      row: r + 1, documentType: type ?? documentType, documentNumber, name, errors,
      status: errors.length ? 'invalid' : duplicate ? 'duplicate' : 'ready',
      ...(duplicate ? { message: duplicate } : {}),
      ...(!errors.length && type ? { payload: {
        document_type: type, document_number: documentNumber, name,
        entity_type: entityType ?? entityTypeFromDocumentType(type),
        tax_responsibility: taxResponsibility,
        type_regime_id: typeRegime?.id ?? 2,
        copy_emails: copyEmails,
        ...(digit ? { check_digit: digit } : {}),
        ...(municipality ? { municipality_id: municipality.id } : {}),
        ...(email ? { email: email.toLowerCase() } : {}),
        ...(phone ? { phone } : {}),
        ...(address ? { address } : {}),
      } } : {}),
    })
  }
  if (!rows.length) throw new Error('La hoja Terceros está vacía. Agrega al menos un tercero desde la fila 2.')
  return rows
}
