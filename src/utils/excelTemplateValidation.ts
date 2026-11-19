import XLSX from 'xlsx-js-style'
import * as CFB from 'cfb'

export interface ExcelTemplateValidation {
  column: number
  type: 'list' | 'date' | 'decimal' | 'textLength' | 'custom'
  operator?: 'between' | 'greaterThan' | 'greaterThanOrEqual'
  formula1: string
  formula2?: string
  optional?: boolean
  prompt: string
}

const xml = (value: string) => value.replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
}[character]!))

/** SheetJS CE does not serialize data validations. Add standard OOXML to
 * the generated archive so dropdowns survive the actual Excel download. */
export function writeExcelTemplate(book: XLSX.WorkBook, validations: ExcelTemplateValidation[], rows: number): ArrayBuffer {
  const buffer = XLSX.write(book, { type: 'array', bookType: 'xlsx', compression: true }) as ArrayBuffer
  const archive = CFB.read(new Uint8Array(buffer), { type: 'buffer' })
  const entry = CFB.find(archive, '/xl/worksheets/sheet1.xml')
  if (!entry?.content) throw new Error('No se pudo preparar la plantilla de Excel.')
  let sheetXml = new TextDecoder().decode(new Uint8Array(entry.content))
  const rules = validations.map(validation => {
    const column = XLSX.utils.encode_col(validation.column)
    return `<dataValidation type="${validation.type}"${validation.operator ? ` operator="${validation.operator}"` : ''} allowBlank="${validation.optional ? 1 : 0}" showInputMessage="0" showErrorMessage="1" errorStyle="stop" errorTitle="Revisa el valor" error="${xml(validation.prompt)}" sqref="${column}2:${column}${rows + 1}"><formula1>${xml(validation.formula1)}</formula1>${validation.formula2 === undefined ? '' : `<formula2>${xml(validation.formula2)}</formula2>`}</dataValidation>`
  }).join('')
  const validationXml = `<dataValidations count="${validations.length}">${rules}</dataValidations>`
  sheetXml = sheetXml.replace(/(<hyperlinks\b|<printOptions\b|<pageMargins\b|<pageSetup\b|<headerFooter\b|<rowBreaks\b|<colBreaks\b|<ignoredErrors\b|<drawing\b|<legacyDrawing\b|<\/worksheet>)/, `${validationXml}$1`)
  sheetXml = sheetXml.replace(/<sheetViews>[\s\S]*?<\/sheetViews>/, '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>')
  CFB.utils.cfb_add(archive, '/xl/worksheets/sheet1.xml', new TextEncoder().encode(sheetXml))
  return new Uint8Array(CFB.write(archive, { type: 'buffer', fileType: 'zip', compression: true })).buffer
}
