import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { createTercerosTemplate, readTercerosWorkbook, TERCEROS_EXCEL_COLUMNS, type TercerosImportCatalogs } from './jarvisTercerosExcel'

const catalogs: TercerosImportCatalogs = {
  municipalities: [{ id: 149, code: '05001', name: 'Medellín' }],
  liabilities: [{ id: 117, code: 'R-99-PN', name: 'No aplica' }, { id: 7, code: 'O-13', name: 'Gran contribuyente' }],
  regimes: [{ id: 2, code: '49', name: 'No Responsable de IVA' }, { id: 1, code: '48', name: 'Responsable de IVA' }],
}
function workbook(rows: unknown[][], edit?: (sheet: XLSX.WorkSheet, book: XLSX.WorkBook) => void) {
  const book = createTercerosTemplate(catalogs)
  const sheet = book.Sheets.Terceros
  XLSX.utils.sheet_add_aoa(sheet, rows, { origin: 'A2' })
  edit?.(sheet, book)
  return XLSX.write(book, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
}
const read = (rows: unknown[][]) => readTercerosWorkbook(workbook(rows), catalogs, [])

describe('plantilla e importación Excel de terceros Jarvis', () => {
  it('genera una plantilla vacía, con tres campos obligatorios, instrucciones y catálogos', () => {
    const book = XLSX.read(workbook([]), { type: 'array', cellNF: true })
    expect(book.SheetNames).toEqual(['Terceros', 'Instrucciones', 'Tipos de documento', 'Personas', 'Responsabilidades', 'Regímenes', 'Ciudades'])
    expect(TERCEROS_EXCEL_COLUMNS.filter(column => column.endsWith('*'))).toHaveLength(3)
    expect(book.Sheets.Terceros.B2.z).toBe('@')
    expect(book.Sheets.Terceros.B1001.z).toBe('@')
    expect(book.Sheets.Ciudades.A2.v).toBe('05001')
    expect(() => readTercerosWorkbook(workbook([]), catalogs, [])).toThrow('está vacía')
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
    expect(read([['CC', 1234, 'Persona', '', '', '', '', 149]])[0].errors).toContain('Código DANE de ciudad desconocido. Consulta la hoja Ciudades.')
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
    expect(() => readTercerosWorkbook(workbook([], (_, book) => { delete book.Sheets.Terceros; book.SheetNames = book.SheetNames.filter(name => name !== 'Terceros') }), catalogs, [])).toThrow('hoja Terceros')
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
