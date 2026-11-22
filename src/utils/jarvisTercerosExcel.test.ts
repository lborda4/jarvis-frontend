import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import * as CFB from 'cfb'
import { createTercerosTemplate, createTercerosTemplateFile, readTercerosWorkbook, TERCEROS_EXCEL_COLUMNS, LEGACY_TERCEROS_EXCEL_COLUMNS, type TercerosImportCatalogs } from './jarvisTercerosExcel'

const catalogs: TercerosImportCatalogs = {
  municipalities: [{ id: 149, code: '05001', name: 'Medellín' }],
  liabilities: [{ id: 117, code: 'R-99-PN', name: 'No aplica' }, { id: 7, code: 'O-13', name: 'Gran contribuyente' }],
  regimes: [{ id: 2, code: '49', name: 'No Responsable de IVA' }, { id: 1, code: '48', name: 'Responsable de IVA' }],
}
function workbook(rows: unknown[][], edit?: (sheet: XLSX.WorkSheet, book: XLSX.WorkBook) => void) {
  const book = XLSX.utils.book_new()
  const sheet = XLSX.utils.aoa_to_sheet([[...LEGACY_TERCEROS_EXCEL_COLUMNS]])
  XLSX.utils.book_append_sheet(book, sheet, 'Terceros')
  XLSX.utils.sheet_add_aoa(sheet, rows, { origin: 'A2' })
  edit?.(sheet, book)
  return XLSX.write(book, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
}
const read = (rows: unknown[][]) => readTercerosWorkbook(workbook(rows), catalogs, [])
function modernWorkbook(rows: unknown[][], edit?: (sheet: XLSX.WorkSheet) => void, options = catalogs) {
  const book = createTercerosTemplate(options)
  XLSX.utils.sheet_add_aoa(book.Sheets.Terceros, rows, { origin: 'A2' })
  edit?.(book.Sheets.Terceros)
  return XLSX.write(book, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
}

describe('plantilla e importación Excel de terceros Jarvis', () => {
  it('genera una sola hoja vacía con cuatro campos obligatorios y catálogos ocultos', () => {
    const buffer = createTercerosTemplateFile(catalogs)
    const book = XLSX.read(buffer, { type: 'array', cellNF: true, cellStyles: true })
    expect(book.SheetNames).toEqual(['Terceros'])
    expect(TERCEROS_EXCEL_COLUMNS).toHaveLength(12)
    expect(TERCEROS_EXCEL_COLUMNS.filter(column => column.endsWith('*'))).toHaveLength(4)
    expect(book.Sheets.Terceros.B2.z).toBe('@')
    expect(book.Sheets.Terceros.B1001.z).toBe('@')
    expect(book.Sheets.Terceros.Q2.v).toBe('05001 — Medellín')
    expect(book.Sheets.Terceros['!cols']?.slice(12, 17).every(column => column.hidden)).toBe(true)
    expect(() => readTercerosWorkbook(buffer, catalogs, [])).toThrow('está vacía')
  })

  it('incluye cinco desplegables reales, validaciones y la cabecera congelada en el archivo descargable', () => {
    const buffer = createTercerosTemplateFile(catalogs)
    const archive = CFB.read(new Uint8Array(buffer), { type: 'buffer' })
    const xml = new TextDecoder().decode(new Uint8Array(CFB.find(archive, '/xl/worksheets/sheet1.xml')!.content))
    for (const name of ['DocumentosTercero', 'PersonasTercero', 'ResponsabilidadesTercero', 'RegimenesTercero', 'CiudadesTercero']) expect(xml).toContain(`<formula1>${name}</formula1>`)
    for (const column of ['A', 'E', 'F', 'G', 'H']) expect(xml).toContain(`sqref="${column}2:${column}1001"`)
    expect(xml).toContain('<dataValidations count="8">')
    expect(xml).toContain('errorStyle="stop"')
    expect(xml).toContain('state="frozen"')
  })

  it('resuelve opciones legibles a códigos e identificadores y conserva los ceros del documento', () => {
    const buffer = modernWorkbook([['CC', '0012345', 'Persona', '', 'Persona natural', 'O-13 — Gran contribuyente', 'Responsable de IVA', '05001 — Medellín']])
    const [row] = readTercerosWorkbook(buffer, catalogs, [])
    expect(row.status).toBe('ready')
    expect(row.payload).toMatchObject({ document_type: 'CC', document_number: '0012345', entity_type: 'natural_person', tax_responsibility: 'O-13', type_regime_id: 1, municipality_id: 149 })
  })

  it('acepta códigos DANE y responsabilidad pegados y exige ciudad en la nueva plantilla', () => {
    const buffer = modernWorkbook([['NIT', '9001', 'Empresa', '', '', 'O-13', '', '05001'], ['CC', '123', 'Sin ciudad']])
    const rows = readTercerosWorkbook(buffer, catalogs, [])
    expect(rows[0].payload).toMatchObject({ municipality_id: 149, tax_responsibility: 'O-13' })
    expect(rows[1].status).toBe('invalid')
    expect(rows[1].errors).toContain('La ciudad es obligatoria. Selecciona una opción de la lista.')
  })

  it('rechaza opciones ajenas al catálogo y fórmulas en las columnas de datos', () => {
    const buffer = modernWorkbook([['CC', '123', 'Persona', '', '', 'O-13 — Inventado', 'Régimen ajeno', '05001 — Ciudad ajena'], ['CC', '124', 'Otra', '', '', '', '', '05001']], sheet => { sheet.C3 = { t: 's', v: 'Otra', f: '"Otra"' } })
    const rows = readTercerosWorkbook(buffer, catalogs, [])
    expect(rows[0].errors).toHaveLength(3)
    expect(rows[1].errors.some(error => error.includes('fórmulas'))).toBe(true)
    expect(rows.every(row => row.payload === undefined)).toBe(true)
  })

  it('no cuenta catálogos de más de 1.000 ciudades como terceros y rechaza columnas extra visibles', () => {
    const options = { ...catalogs, municipalities: Array.from({ length: 1100 }, (_, i) => ({ id: i + 1, code: String(i + 1).padStart(5, '0'), name: `Ciudad ${i}` })) }
    const buffer = modernWorkbook([['CC', '123', 'Persona', '', '', '', '', '01100 — Ciudad 1099']], undefined, options)
    const rows = readTercerosWorkbook(buffer, options, [])
    expect(rows).toHaveLength(1)
    expect(rows[0].payload?.municipality_id).toBe(1100)
    const visibleCatalog = modernWorkbook([], sheet => { sheet['!cols']![12].hidden = false })
    expect(() => readTercerosWorkbook(visibleCatalog, catalogs, [])).toThrow('formato')
  })

  it('importa solo los obligatorios con los mismos valores por defecto que el formulario', () => {
    const rows = read([['NIT', '900123456', 'Empresa de prueba'], ['cc', '0012345', 'Persona de prueba']])
    expect(rows.map(row => row.status)).toEqual(['ready', 'ready'])
    expect(rows[0].payload).toEqual({ document_type: 'NIT', document_number: '900123456', name: 'Empresa de prueba', entity_type: 'legal_entity', tax_responsibility: 'R-99-PN', type_regime_id: 2, copy_emails: [] })
    expect(rows[1].payload).toMatchObject({ document_type: 'CC', document_number: '0012345', entity_type: 'natural_person' })
  })

  it('conserva todos los datos opcionales y resuelve DANE y régimen a los identificadores de Jarvis', () => {
    const [row] = read([['NIT', '900123456', ' Empresa ', '7', 'Persona natural', 'O-13', 'Responsable de IVA', '05001', 'CLIENTE@example.com', '03123456', 'Calle 1 # 2-3', 'copia@example.com;CLIENTE@example.com;copia@example.com']])
    expect(row.errors).toEqual([])
    expect(row.payload).toEqual({ document_type: 'NIT', document_number: '900123456', name: 'Empresa', check_digit: '7', entity_type: 'natural_person', tax_responsibility: 'O-13', type_regime_id: 1, municipality_id: 149, email: 'cliente@example.com', phone: '03123456', address: 'Calle 1 # 2-3', copy_emails: ['copia@example.com'] })
  })

  it('acepta el código DANE numérico de Excel sin confundirlo con el ID interno', () => {
    expect(read([['CC', 1234, 'Persona', '', '', '', '', 5001]])[0].payload?.municipality_id).toBe(149)
    expect(read([['CC', 1234, 'Persona', '', '', '', '', 149]])[0].errors).toContain('Código DANE de ciudad desconocido. Selecciona una ciudad de la lista.')
  })

  it('conserva documentos largos cuando son texto y rechaza números cuya precisión Excel pudo perder', () => {
    expect(read([['PA', '001234567890123456789', 'Extranjero']])[0].payload?.document_number).toBe('001234567890123456789')
    expect(read([['NIT', 1234567890123456, 'Empresa']])[0].status).toBe('invalid')
  })

  it.each([
    [['', '', ''], ['NIT', '', 'Empresa']],
    [['XYZ', '123', 'Persona']],
    [['NIT', '900.123-7', 'Empresa']],
    [['CC', '123', '']],
    [['CC', '123', 'Persona', '11']],
    [['CC', '123', 'Persona', '', 'Empresa inventada']],
    [['CC', '123', 'Persona', '', '', 'O-999']],
    [['CC', '123', 'Persona', '', '', '', 'Régimen inventado']],
    [['CC', '123', 'Persona', '', '', '', '', '99999']],
    [['CC', '123', 'Persona', '', '', '', '', '', 'correo-inválido']],
    [['CC', '123', 'Persona', '', '', '', '', '', '', '', '', 'correo-inválido']],
  ].map(data => ({ data })))('señala la fila inválida y no entrega un payload guardable ($data)', ({ data }) => {
    const invalid = read(data).find(row => row.status === 'invalid')!
    expect(invalid.errors.length).toBeGreaterThan(0)
    expect(invalid.payload).toBeUndefined()
  })

  it('ignora filas vacías y conserva los números originales de fila para corregir el archivo', () => {
    expect(read([[], ['CC', '123', 'Persona'], [], ['CC', '124', 'Otra']]).map(row => row.row)).toEqual([3, 5])
  })

  it('detecta duplicados dentro del archivo y en el catálogo sin actualizar datos existentes', () => {
    const buffer = workbook([['PA', 'AB123', 'Una persona'], ['PA', 'ab123', 'Duplicado'], ['NIT', '900', 'Existe']])
    const rows = readTercerosWorkbook(buffer, catalogs, [{ document_type: 'NIT', document_number: '900' }])
    expect(rows.map(row => row.status)).toEqual(['ready', 'duplicate', 'duplicate'])
    expect(rows[2].message).toContain('ya existe')
  })

  it('no oculta una fila válida si la primera aparición de ese documento tiene errores', () => {
    expect(read([['CC', '123', ''], ['CC', '123', 'Persona']]).map(row => row.status)).toEqual(['invalid', 'ready'])
  })

  it('rechaza fórmulas y errores de Excel sin ejecutarlos', () => {
    const buffer = workbook([['CC', '123', 'Persona']], sheet => { sheet.C2 = { t: 's', f: '"Persona"', v: 'Persona' } })
    expect(readTercerosWorkbook(buffer, catalogs, [])[0].status).toBe('invalid')
  })

  it('rechaza cambios de encabezados, hojas incorrectas, columnas extra y archivos corruptos', () => {
    expect(() => readTercerosWorkbook(workbook([['CC', '123', 'Persona']], sheet => { sheet.A1.v = 'Otro encabezado' }), catalogs, [])).toThrow('encabezados')
    expect(() => readTercerosWorkbook(workbook([], (_, book) => { XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['Otra hoja']]), 'Otra'); delete book.Sheets.Terceros; book.SheetNames = book.SheetNames.filter(name => name !== 'Terceros') }), catalogs, [])).toThrow('hoja Terceros')
    expect(() => readTercerosWorkbook(workbook([], sheet => { XLSX.utils.sheet_add_aoa(sheet, [['Extra']], { origin: 'M1' }) }), catalogs, [])).toThrow('formato')
    expect(() => readTercerosWorkbook(new Uint8Array([0, 1, 2]).buffer, catalogs, [])).toThrow()
  })

  it('admite 1.000 registros y rechaza límites excedidos y rangos inflados', () => {
    const data = Array.from({ length: 1000 }, (_, i) => ['CC', String(i + 1), `Persona ${i}`])
    expect(read(data)).toHaveLength(1000)
    expect(() => read([...data, ['CC', '1001', 'Otra']])).toThrow('máximo 1.000')
    expect(() => readTercerosWorkbook(workbook([], sheet => { sheet['!ref'] = 'A1:L10002' }), catalogs, [])).toThrow('formato')
  })
})
