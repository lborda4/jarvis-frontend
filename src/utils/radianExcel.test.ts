import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { mapRadianInvoices, readRadianWorkbook, suggestRadianMapping } from './radianExcel'

function eligibleSheet(sheet: { name: string; headers: string[]; rows: Record<string, unknown>[] }) {
  return { ...sheet, headers: [...sheet.headers, 'Tipo de documento', 'Forma de Pago', 'Grupo'], rows: sheet.rows.map(row => ({ ...row, 'Tipo de documento': 'Factura electrónica', 'Forma de Pago': 2, Grupo: 'Recibido' })) }
}

describe('Excel RADIAN', () => {
  it('incluye solo registros que cumplen las tres condiciones, con pago numérico o texto', () => {
    const base = { CUFE: 'a'.repeat(96), 'Tipo de documento': 'Factura electrónica', 'Forma de Pago': 2, Grupo: 'Recibido' }
    const sheet = { name: 'Datos', headers: Object.keys(base), rows: [
      base,
      { ...base, CUFE: 'b'.repeat(96), 'Forma de Pago': ' 2 ', Grupo: ' RECIBIDO ', 'Tipo de documento': ' factura electronica ' },
      { ...base, CUFE: 'c'.repeat(96), 'Tipo de documento': 'Nota crédito' },
      { ...base, CUFE: 'd'.repeat(96), 'Forma de Pago': 1 },
      { ...base, CUFE: 'e'.repeat(96), Grupo: 'Emitido' },
    ] }
    expect(mapRadianInvoices(sheet, suggestRadianMapping(sheet.headers)).map(row => row.cufe)).toEqual(['a'.repeat(96), 'b'.repeat(96)])
  })

  it('no importa registros cuando faltan las columnas de filtrado', () => {
    const sheet = { name: 'Datos', headers: ['CUFE'], rows: [{ CUFE: 'a'.repeat(96) }] }
    expect(mapRadianInvoices(sheet, suggestRadianMapping(sheet.headers))).toEqual([])
  })

  it('filtra antes de consolidar CUFE duplicados', () => {
    const row = { CUFE: 'a'.repeat(96), 'Tipo de documento': 'Factura electrónica', 'Forma de Pago': 2, Grupo: 'Recibido' }
    const sheet = { name: 'Datos', headers: Object.keys(row), rows: [{ ...row, Grupo: 'Emitido' }, row] }
    expect(mapRadianInvoices(sheet, suggestRadianMapping(sheet.headers))).toHaveLength(1)
  })
  it('detecta encabezados tras el título del reporte DIAN y conserva todas las filas', () => {
    const sheet = XLSX.utils.aoa_to_sheet([
      ['Reporte DIAN'], [], ['CUFE', 'Número factura', 'Nombre Emisor', 'NIT Emisor', 'Fecha Emisión'],
      ['a'.repeat(96), 'FE1', 'Empresa Uno', '900001', '12/10/2026'],
      ['b'.repeat(96), 'FE2', 'Empresa Dos', '900002', '2026-10-10'],
    ])
    const book = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(book, sheet, 'Recibidas')
    const [imported] = readRadianWorkbook(XLSX.write(book, { type: 'array', bookType: 'xlsx' }))
    const rows = mapRadianInvoices(eligibleSheet(imported), suggestRadianMapping(imported.headers))
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ number: 'FE1', nit: '900001', date: '2026-10-12', valid: true })
    expect(rows[1].supplier).toBe('Empresa Dos')
  })

  it('elimina CUFE duplicados sin distinguir mayúsculas y marca los inválidos', () => {
    const sheet = { name: 'Datos', headers: ['CUFE'], rows: [{ CUFE: 'a'.repeat(96) }, { CUFE: 'A'.repeat(96) }, { CUFE: 'inválido' }, { CUFE: '' }] }
    const rows = mapRadianInvoices(eligibleSheet(sheet), suggestRadianMapping(sheet.headers))
    expect(rows).toHaveLength(3)
    expect(rows[0].valid).toBe(true)
    expect(rows[1].valid).toBe(false)
    expect(rows[2].valid).toBe(false)
  })

  it('permite asignar columnas manualmente y reconoce fechas numéricas de Excel', () => {
    const sheet = { name: 'Datos', headers: ['Código', 'Día'], rows: [{ Código: 'c'.repeat(96), Día: 46307 }] }
    const [row] = mapRadianInvoices(eligibleSheet(sheet), { cufe: 'Código', date: 'Día', number: '', supplier: '', nit: '' })
    expect(row.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(row.valid).toBe(true)
  })

  it('muestra registros sin CUFE como inválidos en lugar de ocultarlos', () => {
    const sheet = { name: 'Datos', headers: ['CUFE', 'Número'], rows: [{ CUFE: '', Número: 'FE1' }, { CUFE: '', Número: 'FE2' }] }
    const rows = mapRadianInvoices(eligibleSheet(sheet), suggestRadianMapping(sheet.headers))
    expect(rows).toHaveLength(2)
    expect(rows.every(row => !row.valid)).toBe(true)
  })
})
