import XLSX from 'xlsx-js-style'
import type { ElectronicDocumentListItem } from '../types/electronicDocument'
import { IMPORT_ROW_STATUS, type ImportRowStatus } from '../types/import'
import { triggerBrowserDownload } from './downloadFile'
import { mapDocumentToImportRowStatus } from './mapImportRowStatus'

/** Paleta Jarvis (sin #) — ver src/index.css */
const JARVIS_COLORS = {
  navy: '0B1F33',
  navySoft: '143049',
  primary: '0D9488',
  primaryHover: '0F766E',
  primarySoft: 'E6F7F5',
  text: '1F2937',
  textMuted: '5B6875',
  white: 'FFFFFF',
  border: 'D7DEE7',
} as const

const COLUMN_COUNT = 12
/** Fila 1-based del encabezado de columnas (CUFE, Prefijo, …). */
export const PURCHASE_INVOICE_EXPORT_TABLE_HEADER_ROW = 6

type JarvisCellStyle = XLSX.CellObject['s']

const MONTH_NAMES_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
] as const

export interface InvoiceNumberParts {
  prefix: string
  consecutive: string
}

/** Separa letras (prefijo) de dígitos (consecutivo): POSE3254 → POSE | 3254. */
export function splitInvoiceNumber(
  invoiceNumber: string | null | undefined,
): InvoiceNumberParts {
  const raw = invoiceNumber?.trim() || ''
  if (!raw) {
    return { prefix: '', consecutive: '' }
  }

  const match = raw.match(/^([^\d]*?)(\d.*)$/)
  if (!match) {
    return { prefix: raw.replace(/[-_\s]+$/g, ''), consecutive: '' }
  }

  return {
    prefix: match[1].replace(/[-_\s]+$/g, ''),
    consecutive: match[2],
  }
}

/** Primer y último día del mes calendario de `reference` (local), ISO YYYY-MM-DD. */
export function getCurrentCalendarMonthRange(
  reference: Date = new Date(),
): { from: string; to: string } {
  const year = reference.getFullYear()
  const month = reference.getMonth()
  const from = new Date(year, month, 1)
  const to = new Date(year, month + 1, 0)

  return {
    from: toIsoDateLocal(from),
    to: toIsoDateLocal(to),
  }
}

/** ISO YYYY-MM-DD desde issueDate del documento (primeros 10 chars). */
function normalizeIssueDateIso(value: string | null | undefined): string {
  const trimmed = value?.trim()
  if (!trimmed) {
    return ''
  }

  const match = /^(\d{4}-\d{2}-\d{2})/.exec(trimmed)
  return match ? match[1] : ''
}

/** Rango para cabecera/nombre de archivo a partir de las filas exportadas. */
export function inferExportDisplayPeriodFromDocuments(
  documents: ElectronicDocumentListItem[],
): { from: string; to: string } {
  const isoDates = documents
    .map((document) => normalizeIssueDateIso(document.issueDate))
    .filter(Boolean)
    .sort()

  if (isoDates.length === 0) {
    return { from: '', to: '' }
  }

  return { from: isoDates[0], to: isoDates[isoDates.length - 1] }
}

/**
 * Texto del periodo en el Excel: rango de filtro, mes por defecto, o min/max
 * de las filas cuando solo hay otros filtros (proveedor, estado, etc.).
 */
export function resolveExportDisplayPeriod(params: {
  issueDateFrom?: string
  issueDateTo?: string
  usedDefaultMonth: boolean
  documents: ElectronicDocumentListItem[]
  reference?: Date
}): { from: string; to: string } {
  const { issueDateFrom, issueDateTo, usedDefaultMonth, documents, reference } =
    params

  if (usedDefaultMonth) {
    return getCurrentCalendarMonthRange(reference)
  }

  const from = issueDateFrom?.trim()
  const to = issueDateTo?.trim()

  if (from || to) {
    return {
      from: from || to || '',
      to: to || from || '',
    }
  }

  return inferExportDisplayPeriodFromDocuments(documents)
}

function toIsoDateLocal(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatPeriodHeader(from: string, to: string): string {
  return `De ${formatSpanishLongDate(from)} a ${formatSpanishLongDate(to)}`
}

function formatSpanishLongDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate)
  if (!match) {
    return isoDate
  }

  const year = Number(match[1])
  const monthIndex = Number(match[2]) - 1
  const day = Number(match[3])
  const monthName = MONTH_NAMES_ES[monthIndex] ?? match[2]

  return `${monthName} ${day} ${year}`
}

function formatIssueDate(value: string | null | undefined): string {
  const trimmed = value?.trim()
  if (!trimmed) {
    return ''
  }

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed)
  if (isoMatch) {
    return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`
  }

  return trimmed
}

function formatSiigoDocumentNumber(
  value: string | number | null | undefined,
): string {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value).trim()
}

function resolveExportImportStatus(
  document: ElectronicDocumentListItem,
): ImportRowStatus {
  if (document.requiresReview) {
    return IMPORT_ROW_STATUS.REQUIERE_REVISION
  }

  return mapDocumentToImportRowStatus(document)
}

export interface PurchaseInvoicePeriodExportCompany {
  name: string
  nit: string
}

export interface BuildPurchaseInvoicePeriodWorkbookParams {
  documents: ElectronicDocumentListItem[]
  company: PurchaseInvoicePeriodExportCompany
  periodFrom: string
  periodTo: string
}

/** Arma el workbook estilo “Ventas por cliente” pero con filas de compra. */
export function buildPurchaseInvoicePeriodWorkbook(
  params: BuildPurchaseInvoicePeriodWorkbookParams,
): XLSX.WorkBook {
  const { documents, company, periodFrom, periodTo } = params

  const headerRows: (string | number)[][] = [
    ['Compras por proveedor'],
    [company.name || ''],
    [company.nit || ''],
    [formatPeriodHeader(periodFrom, periodTo)],
    [],
    [
      'CUFE',
      'Prefijo',
      'Consecutivo',
      'Proveedor',
      'NIT proveedor',
      'Fecha emisión',
      'Estado',
      'Consecutivo SIIGO',
      'Valor bruto',
      'Impuesto cargo',
      'Impuesto retención',
      'Total',
    ],
  ]

  const sorted = [...documents].sort((left, right) => {
    const leftDate = left.issueDate ?? ''
    const rightDate = right.issueDate ?? ''
    if (leftDate !== rightDate) {
      return leftDate.localeCompare(rightDate)
    }
    return (left.invoiceNumber ?? '').localeCompare(right.invoiceNumber ?? '')
  })

  let totalBruto = 0
  let totalIva = 0
  let totalRetention = 0
  let totalPayable = 0

  const dataRows = sorted.map((document) => {
    const { prefix, consecutive } = splitInvoiceNumber(document.invoiceNumber)
    const bruto = Number(document.documentSubtotal) || 0
    const iva = Number(document.documentIva) || 0
    const total = Number(document.total) || 0
    // Sin el panel de retenciones editadas, el export reporta 0 aquí —
    // el Total sigue siendo el payable certificado por la DIAN.
    const retention = 0

    totalBruto += bruto
    totalIva += iva
    totalRetention += retention
    totalPayable += total

    return [
      document.cufe?.trim() || '',
      prefix,
      consecutive,
      document.supplierName?.trim() || '',
      document.supplierNit?.trim() || '',
      formatIssueDate(document.issueDate),
      resolveExportImportStatus(document),
      formatSiigoDocumentNumber(document.siigoDocumentNumber),
      bruto,
      iva,
      retention,
      total,
    ]
  })

  const totalsRow = [
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    'TOTALES',
    totalBruto,
    totalIva,
    totalRetention,
    totalPayable,
  ]

  const tableHeaderRowIndex = headerRows.length - 1
  const firstDataRowIndex = headerRows.length
  const totalsRowIndex =
    dataRows.length > 0 ? firstDataRowIndex + dataRows.length : null

  const aoa = [
    ...headerRows,
    ...dataRows,
    ...(dataRows.length > 0 ? [totalsRow] : []),
  ]

  const sheet = XLSX.utils.aoa_to_sheet(aoa)

  applyPurchaseInvoicePeriodSheetPresentation(sheet, {
    tableHeaderRowIndex,
    firstDataRowIndex,
    totalsRowIndex,
    dataRowCount: dataRows.length,
  })

  sheet['!cols'] = [
    { wch: 48 },
    { wch: 10 },
    { wch: 14 },
    { wch: 36 },
    { wch: 16 },
    { wch: 14 },
    { wch: 18 },
    { wch: 16 },
    { wch: 14 },
    { wch: 14 },
    { wch: 16 },
    { wch: 14 },
  ]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, 'Compras-por-prov')
  return workbook
}

function solidFill(rgb: string): NonNullable<JarvisCellStyle>['fill'] {
  return { patternType: 'solid', fgColor: { rgb } }
}

function setCellStyle(
  sheet: XLSX.WorkSheet,
  row: number,
  col: number,
  style: JarvisCellStyle,
): void {
  const ref = XLSX.utils.encode_cell({ r: row, c: col })
  const cell = sheet[ref]
  if (!cell) {
    return
  }
  cell.s = style
}

function styleRowRange(
  sheet: XLSX.WorkSheet,
  row: number,
  style: JarvisCellStyle,
  fromCol = 0,
  toCol = COLUMN_COUNT - 1,
): void {
  for (let col = fromCol; col <= toCol; col += 1) {
    setCellStyle(sheet, row, col, style)
  }
}

function applyPurchaseInvoicePeriodSheetPresentation(
  sheet: XLSX.WorkSheet,
  layout: {
    tableHeaderRowIndex: number
    firstDataRowIndex: number
    totalsRowIndex: number | null
    dataRowCount: number
  },
): void {
  const lastCol = COLUMN_COUNT - 1

  sheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: lastCol } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: lastCol } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: lastCol } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: lastCol } },
  ]

  const titleStyle: JarvisCellStyle = {
    font: {
      bold: true,
      sz: 14,
      color: { rgb: JARVIS_COLORS.white },
    },
    fill: solidFill(JARVIS_COLORS.navy),
    alignment: { vertical: 'center', horizontal: 'left', indent: 1 },
  }

  const companyNameStyle: JarvisCellStyle = {
    font: {
      bold: true,
      sz: 12,
      color: { rgb: JARVIS_COLORS.white },
    },
    fill: solidFill(JARVIS_COLORS.navySoft),
    alignment: { vertical: 'center', horizontal: 'left', indent: 1 },
  }

  const companyNitStyle: JarvisCellStyle = {
    font: {
      sz: 11,
      color: { rgb: JARVIS_COLORS.white },
    },
    fill: solidFill(JARVIS_COLORS.navySoft),
    alignment: { vertical: 'center', horizontal: 'left', indent: 1 },
  }

  const periodStyle: JarvisCellStyle = {
    font: {
      bold: true,
      sz: 11,
      color: { rgb: JARVIS_COLORS.primaryHover },
    },
    fill: solidFill(JARVIS_COLORS.primarySoft),
    alignment: { vertical: 'center', horizontal: 'left', indent: 1 },
    border: {
      bottom: { style: 'thin', color: { rgb: JARVIS_COLORS.primary } },
    },
  }

  styleRowRange(sheet, 0, titleStyle)
  styleRowRange(sheet, 1, companyNameStyle)
  styleRowRange(sheet, 2, companyNitStyle)
  styleRowRange(sheet, 3, periodStyle)

  const columnHeaderStyle: JarvisCellStyle = {
    font: {
      bold: true,
      sz: 10,
      color: { rgb: JARVIS_COLORS.white },
    },
    fill: solidFill(JARVIS_COLORS.primary),
    alignment: {
      vertical: 'center',
      horizontal: 'center',
      wrapText: true,
    },
    border: {
      top: { style: 'thin', color: { rgb: JARVIS_COLORS.primaryHover } },
      bottom: { style: 'thin', color: { rgb: JARVIS_COLORS.primaryHover } },
      left: { style: 'thin', color: { rgb: JARVIS_COLORS.primaryHover } },
      right: { style: 'thin', color: { rgb: JARVIS_COLORS.primaryHover } },
    },
  }

  styleRowRange(sheet, layout.tableHeaderRowIndex, columnHeaderStyle)

  const moneyFormat = '#,##0.00'
  const dataTextStyle: JarvisCellStyle = {
    font: { sz: 10, color: { rgb: JARVIS_COLORS.text } },
    alignment: { vertical: 'center' },
    border: {
      bottom: { style: 'thin', color: { rgb: JARVIS_COLORS.border } },
    },
  }
  const dataMoneyStyle: JarvisCellStyle = {
    ...dataTextStyle,
    numFmt: moneyFormat,
    alignment: { vertical: 'center', horizontal: 'right' },
  }

  for (let row = layout.firstDataRowIndex; row < layout.firstDataRowIndex + layout.dataRowCount; row += 1) {
    const stripe =
      (row - layout.firstDataRowIndex) % 2 === 1
        ? solidFill(JARVIS_COLORS.primarySoft)
        : undefined

    for (let col = 0; col < COLUMN_COUNT; col += 1) {
      const isMoneyColumn = col >= 8
      setCellStyle(sheet, row, col, {
        ...(isMoneyColumn ? dataMoneyStyle : dataTextStyle),
        ...(stripe ? { fill: stripe } : {}),
      })
    }
  }

  if (layout.totalsRowIndex !== null) {
    const totalsLabelStyle: JarvisCellStyle = {
      font: { bold: true, sz: 10, color: { rgb: JARVIS_COLORS.text } },
      fill: solidFill(JARVIS_COLORS.primarySoft),
      alignment: { vertical: 'center', horizontal: 'right' },
      border: {
        top: { style: 'medium', color: { rgb: JARVIS_COLORS.primary } },
      },
    }
    const totalsMoneyStyle: JarvisCellStyle = {
      font: { bold: true, sz: 10, color: { rgb: JARVIS_COLORS.text } },
      fill: solidFill(JARVIS_COLORS.primarySoft),
      numFmt: moneyFormat,
      alignment: { vertical: 'center', horizontal: 'right' },
      border: {
        top: { style: 'medium', color: { rgb: JARVIS_COLORS.primary } },
      },
    }

    for (let col = 0; col < COLUMN_COUNT; col += 1) {
      if (col < 7) {
        setCellStyle(sheet, layout.totalsRowIndex, col, totalsLabelStyle)
      } else if (col === 7) {
        setCellStyle(sheet, layout.totalsRowIndex, col, totalsLabelStyle)
      } else {
        setCellStyle(sheet, layout.totalsRowIndex, col, totalsMoneyStyle)
      }
    }
  }

  sheet['!rows'] = [
    { hpt: 28 },
    { hpt: 22 },
    { hpt: 20 },
    { hpt: 22 },
    { hpt: 8 },
    { hpt: 32 },
  ]

  const autofilterLastRow =
    layout.dataRowCount > 0
      ? layout.firstDataRowIndex + layout.dataRowCount - 1
      : layout.tableHeaderRowIndex

  sheet['!autofilter'] = {
    ref: XLSX.utils.encode_range({
      s: { r: layout.tableHeaderRowIndex, c: 0 },
      e: { r: autofilterLastRow, c: lastCol },
    }),
  }

  sheet['!views'] = [
    {
      state: 'frozen',
      ySplit: layout.tableHeaderRowIndex + 1,
      topLeftCell: XLSX.utils.encode_cell({
        r: layout.firstDataRowIndex,
        c: 0,
      }),
      activeCell: XLSX.utils.encode_cell({
        r: layout.firstDataRowIndex,
        c: 0,
      }),
    },
  ]
}

export function buildPurchaseInvoicePeriodExportFilename(
  from: string,
  to: string,
): string {
  const safeFrom = from.replace(/[^\d-]/g, '')
  const safeTo = to.replace(/[^\d-]/g, '')

  if (!safeFrom && !safeTo) {
    return 'resumen-compras.xlsx'
  }

  return `resumen-compras-${safeFrom || safeTo}_${safeTo || safeFrom}.xlsx`
}

export function downloadPurchaseInvoicePeriodWorkbook(
  workbook: XLSX.WorkBook,
  filename: string,
): void {
  const buffer = XLSX.write(workbook, {
    bookType: 'xlsx',
    type: 'array',
  }) as ArrayBuffer

  triggerBrowserDownload(
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    filename,
  )
}
