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

export default function JarvisReportResults({ data, onPage, onPageSize }: {
  data: JarvisReportResult
  onPage: (page: number) => void
  onPageSize: (pageSize: number) => void
}) {
  const showPagination = shouldShowTablePagination(data.total, data.pageSize)
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize))
  return <>
    <div className="jarvis-reports__totals" aria-label="Totales de todos los registros filtrados">
      {data.totals.map(total => <section className="jarvis-reports__total-currency" key={String(total.currency)}>
        <h2>Totales consolidados · {total.currency}</h2>
        <p>{total.invoiceCount} facturas · {total.creditCount} notas crédito / ajuste · {total.debitCount} notas débito</p>
        <dl>{totalLabels.map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{formatReportValue(total[key], 'money')}</dd></div>)}</dl>
        {data.filters.report === 'products' && <p>Cantidad vendida: {formatReportValue(total.soldQuantity, 'number')} · Devuelta: {formatReportValue(total.returnedQuantity, 'number')} · Notas débito: {formatReportValue(total.debitQuantity, 'number')} · Neta: {formatReportValue(total.netQuantity, 'number')}</p>}
      </section>)}
    </div>
    <section className="integration-card jarvis-reports__result">
      <div className="jarvis-reports__result-heading"><h2>{data.filters.view === 'detail' ? 'Registros individuales' : 'Consolidado'}</h2><span>{data.total.toLocaleString('es-CO')} registros filtrados</span></div>
      {data.items.length ? <div className="jarvis-reports__table-scroll"><table className="integration-table">
        <thead><tr>{data.columns.map(column => <th scope="col" key={column.key}>{column.label}</th>)}</tr></thead>
        <tbody>{data.items.map((row, index) => <tr key={`${row.id ?? ''}:${row.sellerId ?? ''}:${index}`}>
          {data.columns.map(column => <td key={column.key} className={column.format === 'text' ? undefined : 'jarvis-reports__numeric'}>{formatReportValue(row[column.key], column.format)}</td>)}
        </tr>)}</tbody>
      </table></div> : <p className="jarvis-reports__empty">No hay registros para los filtros seleccionados.</p>}
      {showPagination && <footer className="jarvis-reports__pagination">
        <Button variant="outline" disabled={data.page <= 1} onClick={() => onPage(data.page - 1)}>Anterior</Button>
        <span>Página {data.page} de {pages}</span>
        <Button variant="outline" disabled={data.page >= pages} onClick={() => onPage(data.page + 1)}>Siguiente</Button>
        <label>Filas por página<select value={data.pageSize} onChange={event => onPageSize(Number(event.target.value))}>{[10, 20, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}</select></label>
      </footer>}
    </section>
    <details className="integration-card jarvis-reports__criteria"><summary>Criterios y observaciones del reporte</summary><ul>{data.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul></details>
  </>
}
