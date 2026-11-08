import * as XLSX from 'xlsx'
import { JARVIS_DOCUMENT_TYPE_OPTIONS, type JarvisTercero } from '../types/jarvis'
import type { InvoiceDraftState } from '../types/invoiceDraft'
import type { JarvisPaymentMethod } from '../services/jarvisPaymentMethodService'
import type { JarvisSeller } from '../services/jarvisSellerService'
import { isCreditPaymentMethod } from './paymentNegotiation'
import { calculateSalesInvoiceTax, formatSalesInvoiceTaxLabel, type SalesInvoiceTaxOption } from './salesInvoiceTaxes'
import { calculateJarvisRetention } from './jarvisTaxTechnical'
import { normalizeJarvisTaxType } from './jarvisTaxPresets'

export const SUPPORT_IMPORT_LIMIT = 1000
export const SUPPORT_IMPORT_MAX_BYTES = 5 * 1024 * 1024
export const SUPPORT_TEMPLATE_FILENAME = 'plantilla-documentos-soporte-jarvis.xlsx'
export const SUPPORT_EXCEL_COLUMNS = [
  'Referencia *', 'Fecha de emisión *', 'Tipo de documento *', 'NIT / identificación *',
  'Descripción *', 'Cantidad *', 'Valor unitario *', 'Forma de pago *', 'Vencimiento',
  'Moneda', 'Código producto', 'Descuento (valor)', 'IVA (%)', 'Retefuente (%)',
  'ReteICA (por mil)', 'ReteIVA (%)', 'Observaciones', 'Nota del ítem',
] as const
export const SALES_INVOICE_EXCEL_COLUMNS = [...SUPPORT_EXCEL_COLUMNS, 'Vendedores', 'Nota de encabezado', 'Nota al pie'] as const
export type InvoiceImportKind = 'support' | 'sales'
export interface SupportImportCatalogs {
  paymentMethods: JarvisPaymentMethod[]
  taxes: SalesInvoiceTaxOption[]
  currencies: string[]
  sellers?: JarvisSeller[]
}
export interface SupportImportRow {
  row: number
  sourceRows: number[]
  reference: string
  documentType: string
  identification: string
  draftId?: string
  errors: string[]
  status: 'ready' | 'invalid' | 'missing_supplier' | 'saved' | 'duplicate' | 'failed'
  state: InvoiceDraftState
  message?: string
}
const normalize = (value: string) => value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
export const supportReferenceKey = normalize
export const supportSupplierKey = (type: string, number: string) => `${type.trim().toUpperCase()}:${number.trim().toUpperCase()}`

export function createSupportDocumentsTemplate(catalogs?: SupportImportCatalogs, kind: InvoiceImportKind = 'support'): XLSX.WorkBook {
  const sales = kind === 'sales'
  const sheetName = sales ? 'Facturas de venta' : 'Documentos soporte'
  const columns = sales ? SALES_INVOICE_EXCEL_COLUMNS : SUPPORT_EXCEL_COLUMNS
  const party = sales ? 'cliente' : 'proveedor'
  const book = XLSX.utils.book_new()
  const sheet = XLSX.utils.aoa_to_sheet([[...columns]])
  for (let r = 1; r <= SUPPORT_IMPORT_LIMIT; r++) for (let c = 0; c < columns.length; c++) sheet[XLSX.utils.encode_cell({ r, c })] = { t: 's', v: '', z: '@' }
  sheet['!ref'] = `A1:${XLSX.utils.encode_col(columns.length - 1)}${SUPPORT_IMPORT_LIMIT + 1}`
  sheet['!cols'] = columns.map((_, c) => ({ wch: [4, 16, 17, 19, 20].includes(c) ? 45 : 27 }))
  XLSX.utils.book_append_sheet(book, sheet, sheetName)
  const add = (name: string, rows: (string | number)[][], widths: number[]) => {
    const reference = XLSX.utils.aoa_to_sheet(rows)
    reference['!cols'] = widths.map(wch => ({ wch }))
    XLSX.utils.book_append_sheet(book, reference, name)
  }
  add('Instrucciones', [
    [`Plantilla de ${sheetName.toLowerCase()} Jarvis`, 'Instrucciones'],
    ['Cómo llenar', `Completa ${sheetName} desde la fila 2. Conserva la hoja, los encabezados y su orden. Hasta 1.000 filas por archivo de máximo 5 MB.`],
    ['Referencia', `Código único elegido por ti para identificar cada documento, por ejemplo ${sales ? 'FV-VENTA-001' : 'DS-COMPRA-001'}. No es el consecutivo DIAN. Usa una referencia nueva para cada documento nuevo.`],
    ['Varios ítems', `Repite la referencia en cada ítem del mismo documento. Repite también fecha, ${party}, forma de pago, vencimiento, moneda, retenciones generales y observaciones sin cambiar sus valores.${sales ? ' Conserva también los vendedores y las notas de encabezado y pie.' : ''}`],
    ['NIT / identificación', 'El tercero debe existir primero en Jarvis con el mismo tipo y número. Sin puntos, espacios, guiones ni dígito de verificación. Si falta alguno, no se guardará la carga.'],
    ['Tipo de documento', 'NIT, CC, CE o PA. Consulta Tipos de documento.'],
    ['Fechas', 'AAAA-MM-DD o DD/MM/AAAA; también se aceptan fechas de Excel. El vencimiento es obligatorio para pagos a crédito y debe ser igual o posterior a la emisión.'],
    ['Forma de pago', 'Nombre de una forma de pago existente de Jarvis. Descarga la plantilla desde la aplicación para consultar la hoja Formas de pago.'],
    ['Importes', 'Usa números de Excel o texto sin separadores de miles ni símbolos: 1250,50 o 1250.50. Valor unitario mayor que cero, hasta dos decimales. Cantidad mayor que cero, hasta seis decimales.'],
    ['Moneda', 'Opcional, COP por defecto. Consulta Monedas.'],
    ['Código producto', 'Opcional. La descripción, cantidad y valor unitario de cada ítem son obligatorios, incluso si escribes un código.'],
    ['Descuento (valor)', 'Descuento por ítem en dinero, no en porcentaje. Vacío significa cero; no puede superar cantidad por valor unitario.'],
    ['Impuestos y retenciones', 'Tarifas de las hojas IVA, Retefuente, ReteICA y ReteIVA. En blanco o cero significa sin ese impuesto. IVA y Retefuente son por ítem. ReteICA y ReteIVA son por documento.'],
    ['Guardado', 'Se crean documentos en estado Guardado. Ábrelos desde el listado para revisar y enviar a DIAN. El consecutivo se asignará al enviarlos.'],
    ['Reintentos', 'Las referencias ya guardadas como borrador se omiten sin sobrescribirlas. Puedes reintentar fallos de conexión. Conserva la referencia para no repetir el documento.'],
    ...(sales ? [['Vendedores', 'Opcional. Nombres de vendedores existentes, separados por punto y coma. Consulta la hoja Vendedores. No se crean vendedores al importar.'], ['Notas de encabezado y pie', 'Opcionales. Se guardan en la factura y deben coincidir en todos sus ítems.']] : []),
  ], [30, 115])
  add('Tipos de documento', [['Código', 'Descripción'], ...JARVIS_DOCUMENT_TYPE_OPTIONS.map(item => [item.value, item.label])], [20, 35])
  add('Formas de pago', [['Nombre', 'Negociación'], ...(catalogs?.paymentMethods.map(item => [item.name, isCreditPaymentMethod(item) ? 'Crédito' : 'Contado']) ?? [])], [50, 20])
  add('Monedas', [['Código'], ...(catalogs?.currencies ?? ['COP']).map(code => [code])], [20])
  if (sales) add('Vendedores', [['Nombre'], ...(catalogs?.sellers?.map(seller => [seller.name]) ?? [])], [50])
  for (const [name, type] of [['IVA', 'iva'], ['Retefuente', 'reterenta'], ['ReteICA', 'reteica'], ['ReteIVA', 'reteiva']]) {
    const options = catalogs?.taxes.filter(tax => normalizeJarvisTaxType(tax.type) === type && tax.catalogId != null) ?? []
    add(name, [['Tarifa', 'Descripción'], ...options.map(tax => [tax.percentage ?? 0, formatSalesInvoiceTaxLabel(tax)])], [20, 60])
  }
  return book
}

function decimal(value: unknown, precision: number): number {
  if (typeof value === 'number') return value
  const text = String(value ?? '').trim()
  return new RegExp(`^\\d+(?:[.,]\\d{1,${precision}})?$`).test(text) ? Number(text.replace(',', '.')) : NaN
}
function dateValue(value: unknown): string {
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value)
    if (date) return dateValue(`${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`)
  }
  if (value instanceof Date) value = `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
  let text = String(value ?? '').trim()
  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text)
  if (dmy) text = `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number(text.slice(0, 4)) < 1900) return ''
  const parsed = new Date(`${text}T12:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === text ? text : ''
}

export function resolveSupportSuppliers(rows: SupportImportRow[], suppliers: JarvisTercero[], kind: InvoiceImportKind = 'support'): SupportImportRow[] {
  const byKey = new Map(suppliers.map(supplier => [supportSupplierKey(supplier.document_type, supplier.document_number), supplier]))
  return rows.map(row => {
    if (row.status === 'saved' || row.status === 'duplicate') return row
    const supplier = byKey.get(supportSupplierKey(row.documentType, row.identification))
    return { ...row, state: { ...row.state, selectedCustomer: supplier ? { id: supplier.id, document_type: supplier.document_type, document_number: supplier.document_number, name: supplier.name, check_digit: supplier.check_digit } : null,
      customerQuery: supplier ? `${supplier.document_number} — ${supplier.name}` : '' },
      status: row.errors.length ? 'invalid' : !supplier ? 'missing_supplier' : row.status === 'failed' ? 'failed' : 'ready',
      message: !supplier ? `Debes crear este NIT / identificación en Terceros antes de guardar ${kind === 'sales' ? 'las facturas de venta' : 'los documentos soporte'}.` : row.status === 'failed' ? row.message : undefined,
    }
  })
}

export function readSupportDocumentsWorkbook(buffer: ArrayBuffer, catalogs: SupportImportCatalogs, suppliers: JarvisTercero[], kind: InvoiceImportKind = 'support'): SupportImportRow[] {
  const sales = kind === 'sales'
  const sheetName = sales ? 'Facturas de venta' : 'Documentos soporte'
  const columns = sales ? SALES_INVOICE_EXCEL_COLUMNS : SUPPORT_EXCEL_COLUMNS
  let book: XLSX.WorkBook
  try { book = XLSX.read(buffer, { type: 'array', cellDates: true, cellFormula: true }) }
  catch { throw new Error(`No pudimos leer el Excel. Descarga la plantilla de ${sheetName.toLowerCase()}.`) }
  const sheet = book.Sheets[sheetName]
  if (!sheet?.['!ref']) throw new Error(`El archivo debe contener la hoja ${sheetName} de la plantilla.`)
  const range = XLSX.utils.decode_range(sheet['!ref'])
  if (range.e.r > 10000 || range.e.c >= columns.length) throw new Error(`El archivo no tiene el formato de la plantilla de ${sheetName.toLowerCase()}.`)
  if (columns.some((header, c) => sheet[XLSX.utils.encode_cell({ r: 0, c })]?.v !== header)) throw new Error(`Conserva los encabezados de la plantilla de ${sheetName.toLowerCase()} y su orden.`)
  const groups = new Map<string, { row: SupportImportRow; signature: string }>()
  let count = 0
  for (let r = 1; r <= range.e.r; r++) {
    const cells = columns.map((_, c) => sheet[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined)
    if (!cells.some(cell => cell?.f || String(cell?.v ?? '').trim())) continue
    if (++count > SUPPORT_IMPORT_LIMIT) throw new Error('El archivo admite máximo 1.000 filas de ítems.')
    const values = cells.map(cell => String(cell?.v ?? '').trim())
    const [reference, , typeText, identification, description, , , methodName, , currencyText, code, , , , , , notes, lineNotes] = values
    const errors: string[] = []
    if (cells.some(cell => cell?.f || cell?.t === 'e')) errors.push('Usa valores, sin fórmulas ni errores de Excel.')
    if (cells[3]?.t === 'n' && (typeof cells[3].v !== 'number' || !Number.isSafeInteger(cells[3].v) || Math.abs(cells[3].v) >= 1e15)) errors.push('Conserva el NIT / identificación como texto para no perder dígitos.')
    if (!reference) errors.push('La referencia del documento es obligatoria.')
    const documentType = JARVIS_DOCUMENT_TYPE_OPTIONS.find(item => item.value === typeText.toUpperCase())?.value ?? ''
    if (!documentType) errors.push('Tipo de documento obligatorio: NIT, CC, CE o PA.')
    if (!identification || !/^[a-z\d]+$/i.test(identification) || (['NIT', 'CC'].includes(documentType) && !/^\d+$/.test(identification))) errors.push('NIT / identificación obligatorio, sin puntos, espacios, guiones ni dígito de verificación.')
    const issueDate = dateValue(cells[1]?.v)
    if (!issueDate) errors.push('La fecha de emisión es obligatoria y debe ser válida.')
    const methods = catalogs.paymentMethods.filter(method => normalize(method.name) === normalize(methodName))
    const method = methods.length === 1 ? methods[0] : undefined
    if (!method) errors.push('Forma de pago obligatoria: usa un nombre único de la hoja Formas de pago.')
    const credit = method ? isCreditPaymentMethod(method) : false
    const dueDate = values[8] ? dateValue(cells[8]?.v) : credit ? '' : issueDate
    if (!dueDate || dueDate < issueDate) errors.push('El vencimiento es obligatorio a crédito y no puede ser anterior a la emisión.')
    const currency = currencyText.toUpperCase() || 'COP'
    if (!catalogs.currencies.includes(currency)) errors.push('Moneda desconocida. Consulta la hoja Monedas.')
    if (!description) errors.push('La descripción del ítem es obligatoria.')
    const quantity = decimal(cells[5]?.v, 6)
    const unitValue = decimal(cells[6]?.v, 2)
    const discount = values[11] ? decimal(cells[11]?.v, 2) : 0
    if (!Number.isFinite(quantity) || quantity <= 0 || Math.abs(quantity * 1e6 - Math.round(quantity * 1e6)) > .0001) errors.push('La cantidad debe ser mayor que cero, con hasta seis decimales.')
    if (!Number.isFinite(unitValue) || unitValue <= 0 || Math.abs(unitValue * 100 - Math.round(unitValue * 100)) > .0001) errors.push('El valor unitario debe ser mayor que cero, con hasta dos decimales y sin separadores de miles.')
    if (!Number.isFinite(discount) || discount < 0 || discount > quantity * unitValue) errors.push('Descuento inválido o mayor al valor del ítem.')
    const selectTax = (column: number, type: string): SalesInvoiceTaxOption | undefined => {
      const rate = values[column] ? decimal(cells[column]?.v, 6) : 0
      if (rate === 0) return undefined
      const tax = catalogs.taxes.find(item => normalizeJarvisTaxType(item.type) === type && item.percentage === rate && item.catalogId != null)
      if (!tax) errors.push(`Tarifa de ${SUPPORT_EXCEL_COLUMNS[column]} no disponible. Consulta las hojas de impuestos.`)
      return tax
    }
    const iva = selectTax(12, 'iva'), retefuente = selectTax(13, 'reterenta'), reteIca = selectTax(14, 'reteica'), reteIva = selectTax(15, 'reteiva')
    const sellers: JarvisSeller[] = []
    if (sales) {
      for (const name of [...new Set(values[18].split(';').map(normalize).filter(Boolean))]) {
        const matches = (catalogs.sellers ?? []).filter(seller => normalize(seller.name) === name)
        if (matches.length !== 1) errors.push(`Vendedor "${name}" desconocido o ambiguo. Consulta la hoja Vendedores.`)
        else sellers.push(matches[0])
      }
      sellers.sort((a, b) => a.id.localeCompare(b.id))
    }
    const state: InvoiceDraftState = {
      selectedCustomer: null, customerQuery: '', issueDate, dueDate, currency, notes, headNote: sales ? values[19] : '', footNote: sales ? values[20] : '', discountIsPercent: false, generalDiscount: '0',
      ...(sales ? { selectedSellers: sellers } : {}),
      lines: [], paymentFormId: credit ? '2' : '1', paymentEntries: [{ id: 'payment-1', methodId: method?.id ?? '', amount: '0', automatic: true }],
      reteIcaId: reteIca?.id ?? '', reteIvaId: reteIva?.id ?? '', billingNumber: '', billingUuid: '', billingDate: '', reasonCode: '', reasonDescription: '', seze: '',
    }
    const signature = JSON.stringify([documentType, identification, issueDate, dueDate, currency, method?.id, state.reteIcaId, state.reteIvaId, notes, ...(sales ? [sellers.map(seller => seller.id), state.headNote, state.footNote] : [])])
    const key = normalize(reference) || `missing:${r}`
    let group = groups.get(key)
    if (!group) {
      group = { row: { row: r + 1, sourceRows: [], reference, documentType: documentType || typeText, identification, errors: [], status: 'ready', state }, signature }
      groups.set(key, group)
    } else if (group.signature !== signature) errors.push(`Las filas de la misma referencia deben tener el mismo ${sales ? 'cliente' : 'proveedor'}, fechas, moneda, pago, retenciones generales y observaciones.${sales ? ' También deben coincidir los vendedores y las notas de encabezado y pie.' : ''}`)
    group.row.sourceRows.push(r + 1)
    group.row.errors.push(...errors.map(error => `Fila ${r + 1}: ${error}`))
    group.row.state.lines.push({ id: `line-${r + 1}`, productSearch: code, code, description, quantity: String(quantity), unitValue: String(unitValue), discount: String(discount),
      priceOptions: [], selectedPriceId: '', taxChargeId: iva?.id ?? '', taxPercent: String(iva?.percentage ?? 0), taxRetentionId: retefuente?.id ?? '', ...(lineNotes ? { notes: lineNotes } : {}),
    })
  }
  if (!groups.size) throw new Error(`La hoja ${sheetName} está vacía. Completa al menos un ítem.`)
  const result = [...groups.values()].map(({ row }) => {
    const state = row.state
    let subtotal = 0, ivaTotal = 0, itemRetentions = 0
    for (const line of state.lines) {
      const base = Number(line.quantity) * Number(line.unitValue) - Number(line.discount)
      const iva = calculateSalesInvoiceTax(base, line.taxChargeId, line.taxPercent)
      const retention = catalogs.taxes.find(tax => tax.id === line.taxRetentionId)
      subtotal += base; ivaTotal += iva
      if (retention) itemRetentions += calculateJarvisRetention(retention.type, retention.percentage ?? 0, base, iva)
    }
    const retention = (id: string) => {
      const tax = catalogs.taxes.find(item => item.id === id)
      return tax ? calculateJarvisRetention(tax.type, tax.percentage ?? 0, subtotal, ivaTotal) : 0
    }
    const total = Math.round((subtotal + ivaTotal - itemRetentions - retention(state.reteIcaId) - retention(state.reteIvaId)) * 100) / 100
    if (!Number.isFinite(total) || total <= 0 || !Number.isSafeInteger(Math.round(total * 100))) row.errors.push('El total del documento debe ser mayor que cero y conservar la precisión de los importes.')
    state.documentTotal = Number.isFinite(total) ? total : 0
    state.paymentEntries[0].amount = String(state.documentTotal)
    return row
  })
  return resolveSupportSuppliers(result, suppliers, kind)
}
