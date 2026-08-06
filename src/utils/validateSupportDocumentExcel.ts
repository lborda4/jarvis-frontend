import * as XLSX from 'xlsx'
import {
  formatLocalDate,
  getMinSelectableSupportDocumentDate,
  getTodayLocalDate,
  isSupportDocumentDateInRange,
} from './supportDocumentDate'

export const SUPPORT_DOCUMENT_EXCEL_DATE_ERROR =
  'Solo se permite la fecha hasta 5 días antes de la fecha actual.'

function isRowEmpty(row: unknown[]): boolean {
  return row.every((cell) => {
    if (cell === null || cell === undefined) {
      return true
    }

    return String(cell).trim() === ''
  })
}

function normalizeExcelDateCell(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatLocalDate(value)
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value)

    if (parsed) {
      const date = new Date(parsed.y, parsed.m - 1, parsed.d)
      return formatLocalDate(date)
    }
  }

  const trimmed = String(value ?? '').trim()

  if (!trimmed) {
    return null
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed
  }

  const slashMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)

  if (slashMatch) {
    const [, day, month, year] = slashMatch
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }

  const parsedDate = new Date(trimmed)

  if (!Number.isNaN(parsedDate.getTime())) {
    return formatLocalDate(parsedDate)
  }

  return null
}

export async function validateSupportDocumentExcelDates(
  file: File,
  options?: { enforceDateRange?: boolean },
): Promise<void> {
  const enforceDateRange = options?.enforceDateRange !== false
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  const sheetName = workbook.SheetNames[0]

  if (!sheetName) {
    throw new Error('El archivo Excel no contiene hojas de cálculo.')
  }

  const sheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
  })

  const minDate = getMinSelectableSupportDocumentDate()
  const maxDate = getTodayLocalDate()
  const invalidRows: number[] = []
  const missingDateRows: number[] = []

  rows.slice(1).forEach((row, index) => {
    if (!Array.isArray(row) || isRowEmpty(row)) {
      return
    }

    const excelRowNumber = index + 2
    const normalizedDate = normalizeExcelDateCell(row[0])

    if (!normalizedDate) {
      missingDateRows.push(excelRowNumber)
      return
    }

    if (
      enforceDateRange &&
      !isSupportDocumentDateInRange(normalizedDate, minDate, maxDate)
    ) {
      invalidRows.push(excelRowNumber)
    }
  })

  if (missingDateRows.length > 0) {
    throw new Error(
      `La primera columna debe contener la fecha. Revise la fila ${missingDateRows[0]}.`,
    )
  }

  if (invalidRows.length > 0) {
    throw new Error(
      `${SUPPORT_DOCUMENT_EXCEL_DATE_ERROR} Revise la fila ${invalidRows[0]}.`,
    )
  }
}
