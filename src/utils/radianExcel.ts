import * as XLSX from 'xlsx'

export interface RadianInvoice { cufe: string; number: string; supplier: string; nit: string; date: string; valid: boolean }
export type RadianColumn = 'cufe' | 'number' | 'supplier' | 'nit' | 'date'
export type RadianMapping = Record<RadianColumn, string>
export interface RadianSheet { name: string; headers: string[]; rows: Record<string, unknown>[] }
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
export const isValidCufe = (value: string) => /^[a-f0-9]{96}$/i.test(value)

export function radianFilterColumns(headers: string[]) {
  const find = (name: string) => headers.find(header => normalize(header) === normalize(name))
  return { documentType: find('Tipo de documento'), paymentForm: find('Forma de Pago'), group: find('Grupo') }
}

export function readRadianWorkbook(buffer: ArrayBuffer): RadianSheet[] {
  const book = XLSX.read(buffer, { type: 'array' })
  return book.SheetNames.map(name => {
    const sheet = book.Sheets[name]
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })
    const found = matrix.findIndex(row => row.some(cell => normalize(String(cell)).includes('cufe')))
    const start = found >= 0 ? found : matrix.findIndex(row => row.some(cell => String(cell).trim()))
    if (start < 0) return { name, headers: [], rows: [] }
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { range: start, defval: '' })
    return { name, headers: rows.length ? Object.keys(rows[0]) : [], rows }
  }).filter(sheet => sheet.headers.length)
}

export function suggestRadianMapping(headers: string[]): RadianMapping {
  const aliases: Record<RadianColumn, string[]> = {
    cufe: ['cufe', 'cufecude', 'cufecudeidentificador'],
    number: ['numerofactura', 'numerodocumento', 'folio', 'numero', 'documento'],
    supplier: ['nombreemisor', 'razonsocialemisor', 'proveedor', 'emisor'],
    nit: ['nitemisor', 'nitproveedor', 'nitdel emisor', 'nit'],
    date: ['fechaemision', 'fechadeemision', 'fechaexpedicion', 'fecha'],
  }
  return Object.fromEntries(Object.entries(aliases).map(([key, values]) => [key, headers.find(header => values.map(normalize).includes(normalize(header))) ?? ''])) as RadianMapping
}

function dateValue(value: unknown): string {
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value)
    return parsed ? `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}` : ''
  }
  const text = String(value ?? '').trim()
  const match = text.match(/^(\d{2})[/-](\d{2})[/-](\d{4})/)
  return match ? `${match[3]}-${match[2]}-${match[1]}` : /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : ''
}

export function mapRadianInvoices(sheet: RadianSheet, mapping: RadianMapping, deduplicate = true): RadianInvoice[] {
  const columns = radianFilterColumns(sheet.headers)
  if (!columns.documentType || !columns.paymentForm || !columns.group) return []
  const seen = new Set<string>()
  return sheet.rows.flatMap(row => {
    if (normalize(String(row[columns.documentType!] ?? '')) !== 'facturaelectronica'
      || String(row[columns.paymentForm!] ?? '').trim() !== '2'
      || normalize(String(row[columns.group!] ?? '')) !== 'recibido') return []
    const cufe = String(row[mapping.cufe] ?? '').trim().toLowerCase()
    if (!Object.values(row).some(value => String(value ?? '').trim()) || (deduplicate && cufe && seen.has(cufe))) return []
    if (cufe) seen.add(cufe)
    return [{ cufe, number: String(row[mapping.number] ?? '').trim(), supplier: String(row[mapping.supplier] ?? '').trim(), nit: String(row[mapping.nit] ?? '').trim(), date: dateValue(row[mapping.date]), valid: isValidCufe(cufe) }]
  })
}
