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

export const TERCEROS_IMPORT_LIMIT = 1000
export const TERCEROS_IMPORT_MAX_BYTES = 5 * 1024 * 1024
export const TERCEROS_TEMPLATE_FILENAME = 'plantilla-terceros-jarvis.xlsx'
export const TERCEROS_EXCEL_COLUMNS = [
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

export function createTercerosTemplate(catalogs?: TercerosImportCatalogs): XLSX.WorkBook {
  const book = XLSX.utils.book_new()
  const sheet = XLSX.utils.aoa_to_sheet([[...TERCEROS_EXCEL_COLUMNS]])
  // Preformat entry cells as text to preserve leading zeros and long identification numbers in Excel.
  for (let row = 1; row <= TERCEROS_IMPORT_LIMIT; row++) {
    for (let column = 0; column < TERCEROS_EXCEL_COLUMNS.length; column++) {
      sheet[XLSX.utils.encode_cell({ r: row, c: column })] = { t: 's', v: '', z: '@' }
    }
  }
  sheet['!ref'] = `A1:L${TERCEROS_IMPORT_LIMIT + 1}`
  sheet['!cols'] = TERCEROS_EXCEL_COLUMNS.map((_, i) => ({ wch: i === 2 || i === 10 || i === 11 ? 40 : 27 }))
  sheet['!autofilter'] = { ref: 'A1:L1001' }
  XLSX.utils.book_append_sheet(book, sheet, 'Terceros')
  const instructions = [
    ['Plantilla de terceros Jarvis', 'Instrucciones'],
    ['Cómo llenar', 'Escribe un tercero por fila en la hoja Terceros, desde la fila 2. No cambies los encabezados ni el nombre de la hoja.'],
    ['Campos obligatorios (*)', 'Tipo de documento, número de documento y nombre / razón social. Las demás columnas son opcionales.'],
    ['Tipo de documento', 'Usa NIT, CC, CE o PA. Consulta la hoja Tipos de documento.'],
    ['Número de documento', 'Sin puntos, espacios ni guiones. Para NIT, escribe el dígito de verificación en su propia columna. Conserva el formato Texto.'],
    ['Persona o empresa', 'Persona natural o Persona jurídica. Si está vacío se usa Persona jurídica para NIT y Persona natural para los demás tipos.'],
    ['Tipo de responsabilidad', 'Escribe el código de la hoja Responsabilidades. Si está vacío se usa R-99-PN.'],
    ['Tipo de régimen', 'Escribe el nombre exacto de la hoja Regímenes. Si está vacío se usa No Responsable de IVA.'],
    ['Ciudad (código DANE)', 'Escribe el código DANE de 5 dígitos, no el identificador interno. Consulta la hoja Ciudades al descargar la plantilla desde Jarvis.'],
    ['Correos adicionales (CC)', 'Separa hasta 10 correos con punto y coma. El correo principal no se repite como copia.'],
    ['Límites', 'Hasta 1.000 terceros por archivo. Archivos .xlsx o .xls de máximo 5 MB.'],
    ['Revisión', 'Corrige los errores antes de guardar. Los documentos repetidos en el archivo o que ya existan en Jarvis se omiten. No se actualizan terceros existentes.'],
    ['Guardado', 'Al guardar se muestra el resultado por fila. Si alguna falla, puedes reintentar sin volver a enviar las filas guardadas.'],
  ]
  const addSheet = (name: string, rows: (string | number)[][], widths: number[]) => {
    const reference = XLSX.utils.aoa_to_sheet(rows)
    reference['!cols'] = widths.map(wch => ({ wch }))
    XLSX.utils.book_append_sheet(book, reference, name)
  }
  addSheet('Instrucciones', instructions, [30, 115])
  addSheet('Tipos de documento', [['Valor', 'Descripción'], ...JARVIS_DOCUMENT_TYPE_OPTIONS.map(item => [item.value, item.label])], [18, 35])
  addSheet('Personas', [['Valor'], ...JARVIS_ENTITY_TYPE_OPTIONS.map(item => [item.label])], [25])
  addSheet('Responsabilidades', [['Código', 'Nombre'], ...(catalogs?.liabilities.length
    ? catalogs.liabilities.map(item => [item.code, item.name])
    : JARVIS_TAX_RESPONSIBILITY_OPTIONS.map(item => [item.value, item.label]))], [18, 70])
  addSheet('Regímenes', [['Nombre'], ...(catalogs?.regimes.length ? catalogs.regimes.map(item => [item.name]) : [['No Responsable de IVA']])], [55])
  addSheet('Ciudades', [['Código DANE', 'Nombre'], ...(catalogs?.municipalities.filter(item => item.code).map(item => [item.code!.padStart(5, '0'), item.name]) ?? [])], [18, 60])
  return book
}

export function readTercerosWorkbook(
  buffer: ArrayBuffer,
  catalogs: TercerosImportCatalogs,
  existing: Pick<JarvisTercero, 'document_type' | 'document_number'>[],
): TerceroImportRow[] {
  let book: XLSX.WorkBook
  try { book = XLSX.read(buffer, { type: 'array', cellFormula: true }) }
  catch { throw new Error('No pudimos leer el Excel. Descarga la plantilla y vuelve a intentarlo.') }
  const sheet = book.Sheets.Terceros
  if (!sheet?.['!ref']) throw new Error('El archivo debe contener la hoja Terceros de la plantilla.')
  const range = XLSX.utils.decode_range(sheet['!ref'])
  // Reject inflated worksheet ranges before traversing any cells.
  if (range.e.r > 10000 || range.e.c >= TERCEROS_EXCEL_COLUMNS.length) throw new Error('El archivo no tiene el formato de la plantilla de terceros.')
  const headers = TERCEROS_EXCEL_COLUMNS.map((_, c) => sheet[XLSX.utils.encode_cell({ r: 0, c })]?.v)
  if (headers.some((header, i) => header !== TERCEROS_EXCEL_COLUMNS[i])) {
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
    const taxResponsibility = liability.toUpperCase() || JARVIS_TAX_RESPONSIBILITY.NOT_APPLICABLE
    if (liability && !catalogs.liabilities.some(item => item.code.toUpperCase() === taxResponsibility)) errors.push('Tipo de responsabilidad desconocido. Consulta la hoja Responsabilidades.')
    const typeRegime = catalogs.regimes.find(item => normalize(item.name) === normalize(regime))
    if (regime && !typeRegime) errors.push('Tipo de régimen desconocido. Usa el nombre de la hoja Regímenes.')
    const cityCode = /^\d{1,5}$/.test(city) ? city.padStart(5, '0') : city
    const municipality = catalogs.municipalities.find(item => item.code?.padStart(5, '0') === cityCode)
    if (city && !municipality) errors.push('Código DANE de ciudad desconocido. Consulta la hoja Ciudades.')
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
