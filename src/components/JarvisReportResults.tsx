import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { JarvisReportColumn, JarvisReportResult, JarvisReportRow } from '../services/jarvisReportsService'
import { shouldShowTablePagination } from '../utils/tablePagination'
import Button from './Button'

function formatReportValue(value: JarvisReportRow[string] | undefined, format: JarvisReportColumn['format']): string {
  if (value == null) return 'Sin dato'
  if (format === 'text') return String(value)
  const numeric = Number(value)
  const formatted = new Intl.NumberFormat('es-CO', { minimumFractionDigits: format === 'money' ? 2 : 0, maximumFractionDigits: format === 'money' ? 2 : 6 }).format(numeric === 0 ? 0 : numeric)
  return format === 'percent' ? `${formatted} %` : formatted
}
const totalLabels = [
  ['grossSales', 'Ventas brutas (subtotal)'], ['creditNotes', 'Notas crédito / devoluciones'], ['debitNotes', 'Notas débito'], ['netSales', 'Ventas netas (subtotal)'],
  ['ivaGenerated', 'IVA generado neto en ventas'], ['discount', 'Descuento posterior a impuestos'], ['otherTaxes', 'Otros impuestos'], ['total', 'Valor total'], ['payable', 'Valor después de retenciones'],
  ['retentionsSuffered', 'Retenciones que nos practicaron'], ['retentionsPracticed', 'Retenciones practicadas por nosotros'],
] as const

function salesAmounts(row: JarvisReportRow): JarvisReportRow {
  const sum = (keys: string[]) => {
    if (keys.some(key => row[key] == null || !Number.isFinite(Number(row[key])))) return null
    return Math.round(keys.reduce((total, key) => total + Number(row[key]), 0) * 100) / 100
  }
  return { ...row, taxesCharged: sum(['iva', 'otherTaxes']), taxesRetained: sum(['retefuente', 'reteIca', 'reteIva']) }
}

function kindBadge(kind: JarvisReportRow[string] | undefined): string {
  const label = String(kind ?? '').toLowerCase()
  if (label.includes('crédito') || label.includes('ajuste')) return 'jarvis-reports__badge jarvis-reports__badge--credit'
  if (label.includes('débito')) return 'jarvis-reports__badge jarvis-reports__badge--debit'
  return 'jarvis-reports__badge'
}

const salesColumns: JarvisReportColumn[] = [
  { key: 'date', label: 'Fecha', format: 'text' },
  { key: 'kind', label: 'Tipo de comprobante', format: 'text' },
  { key: 'number', label: 'Comprobante', format: 'text' },
  { key: 'customerId', label: 'Identificación', format: 'text' },
  { key: 'customerName', label: 'Cliente', format: 'text' },
  { key: 'seller', label: 'Vendedor', format: 'text' },
  { key: 'subtotal', label: 'Valor bruto (subtotal)', format: 'money' },
  { key: 'discount', label: 'Descuento posterior a impuestos', format: 'money' },
  { key: 'netSales', label: 'Subtotal neto', format: 'money' },
  { key: 'taxesCharged', label: 'Impuestos a cargo', format: 'money' },
  { key: 'taxesRetained', label: 'Impuestos de retención', format: 'money' },
  { key: 'payable', label: 'Total después de retenciones', format: 'money' },
]

export default function JarvisReportResults({ data, onPage, onPageSize }: {
  data: JarvisReportResult
  onPage: (page: number) => void
  onPageSize: (pageSize: number) => void
}) {
  const [fullColumns, setFullColumns] = useState(false)
  const showPagination = shouldShowTablePagination(data.total, data.pageSize)
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize))
  const productKeys = ['date', 'kind', 'number', 'productName', 'customerName', 'seller', 'quantity', 'unitValue', 'subtotal', 'iva', 'otherTaxes', 'total']
  const taxKeys = ['number', 'customerId', 'customerName', 'date', 'kind', 'subtotal', 'iva', 'retefuente', 'reteIca', 'reteIva', 'otherTaxes']
  const isSalesDetail = data.filters.report === 'sales' && data.filters.view === 'detail'
  const compactKeys = data.filters.report === 'taxes' ? taxKeys : productKeys
  const hasCompactView = ['sales', 'products', 'taxes'].includes(data.filters.report) && data.filters.view === 'detail'
  if (!data.filters.currency || data.totals.length > 1) compactKeys.push('currency')
  const columns = !fullColumns && isSalesDetail
    ? [...salesColumns, ...(!data.filters.currency || data.totals.length > 1 ? data.columns.filter(column => column.key === 'currency') : [])]
    : !fullColumns && hasCompactView
    ? compactKeys.flatMap(key => data.columns.filter(column => column.key === key))
    : data.columns
  const start = data.total ? (data.page - 1) * data.pageSize + 1 : 0
  const end = Math.min(data.page * data.pageSize, data.total)
  return <>
    <section className="integration-card jarvis-reports__result">
      <div className="jarvis-reports__result-heading"><span>{data.total.toLocaleString('es-CO')} registros filtrados</span>{hasCompactView && <Button variant="ghost" aria-pressed={fullColumns} onClick={() => setFullColumns(value => !value)}>{fullColumns ? 'Vista compacta' : 'Ver todas las columnas'}</Button>}</div>
      {data.items.length ? <div className="jarvis-reports__table-scroll"><table className="integration-table">
        <thead><tr>{columns.map(column => <th scope="col" className={column.format === 'text' ? undefined : 'jarvis-reports__numeric'} key={column.key}>{column.label}</th>)}{isSalesDetail && <th scope="col">Acciones</th>}</tr></thead>
        <tbody>{data.items.map((item, index) => { const row = isSalesDetail ? salesAmounts(item) : item; return <tr key={`${row.id ?? ''}:${row.sellerId ?? ''}:${index}`}>
          {columns.map(column => <td key={column.key} className={column.format === 'text' ? undefined : 'jarvis-reports__numeric'}>{column.key === 'kind' ? <span className={kindBadge(row[column.key])}>{formatReportValue(row[column.key], column.format)}</span> : column.key === 'date' && typeof row[column.key] === 'string' ? String(row[column.key]).slice(0, 10).split('-').reverse().join('/') : formatReportValue(row[column.key], column.format)}</td>)}
          {isSalesDetail && <td>{row.id ? <Link className="jarvis-reports__document-link" to={`${String(row.kind).toLowerCase().includes('crédito') ? '/nota-credito' : String(row.kind).toLowerCase().includes('débito') ? '/nota-debito' : '/factura-venta'}/${encodeURIComponent(String(row.id))}/visualizar`} aria-label={`Visualizar comprobante ${row.number}`}>Ver</Link> : '—'}</td>}
        </tr> })}</tbody>
        <tfoot>{data.totals.map(item => { const total = isSalesDetail ? salesAmounts(item) : item; return <tr key={String(total.currency)}>{columns.map((column, index) => <td key={column.key} className={column.format === 'text' ? undefined : 'jarvis-reports__numeric'}>{index === 0 ? `Total general · ${total.currency}` : column.key === 'unitValue' || column.format === 'text' ? '—' : formatReportValue(total[column.key === 'quantity' ? 'netQuantity' : column.key], column.format)}</td>)}{isSalesDetail && <td />}</tr> })}</tfoot>
      </table></div> : <p className="jarvis-reports__empty">No hay registros para los filtros seleccionados.</p>}
      {data.total > 0 && <footer className="jarvis-reports__pagination"><span className="jarvis-reports__record-count">Mostrando {start} a {end} de {data.total} registros</span>
      {showPagination && <>
        <label>Filas por página<select value={data.pageSize} onChange={event => onPageSize(Number(event.target.value))}>{[10, 20, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}</select></label>
        <Button variant="ghost" aria-label="Primera página" disabled={data.page <= 1} onClick={() => onPage(1)}>«</Button>
        <Button variant="outline" disabled={data.page <= 1} onClick={() => onPage(data.page - 1)}>Anterior</Button>
        <span className="jarvis-reports__current-page">Página {data.page} de {pages}</span>
        <Button variant="outline" disabled={data.page >= pages} onClick={() => onPage(data.page + 1)}>Siguiente</Button>
        <Button variant="ghost" aria-label="Última página" disabled={data.page >= pages} onClick={() => onPage(pages)}>»</Button>
      </>}
      </footer>}
    </section>
    <details className="jarvis-reports__totals" aria-label="Totales de todos los registros filtrados"><summary>Ver totales consolidados por moneda</summary>
      {data.totals.map(total => <section className="jarvis-reports__total-currency" key={String(total.currency)}>
        <h2>Totales consolidados · {total.currency}</h2>
        <p>{total.invoiceCount} facturas · {total.creditCount} notas crédito / ajuste · {total.debitCount} notas débito</p>
        <dl>{totalLabels.map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{formatReportValue(total[key], 'money')}</dd></div>)}</dl>
        {data.filters.report === 'products' && <p>Cantidad vendida: {formatReportValue(total.soldQuantity, 'number')} · Devuelta: {formatReportValue(total.returnedQuantity, 'number')} · Notas débito: {formatReportValue(total.debitQuantity, 'number')} · Neta: {formatReportValue(total.netQuantity, 'number')}</p>}
      </section>)}
    </details>
    <details className="integration-card jarvis-reports__criteria"><summary>Criterios y observaciones del reporte</summary><ul>{data.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul></details>
  </>
}
