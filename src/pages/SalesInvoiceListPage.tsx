import { peekCachedQuery } from '../services/queryCache'
import PageHeader from '../components/PageHeader'
import InvoiceNoteActions from '../components/InvoiceNoteActions'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import Button from '../components/Button'
import ErrorMessage from '../components/ErrorMessage'
import LoadingIndicator from '../components/LoadingIndicator'
import { getApiErrorMessage } from '../services/apiClient'
import { jarvisHistoryQueryKey, fetchJarvisCreditNotes, fetchJarvisDebitNotes, fetchJarvisSalesInvoices, fetchJarvisSupportCreditNotes, fetchJarvisSupportInvoices, type JarvisSalesInvoiceList } from '../services/jarvisService'
import './SalesInvoiceListPage.css'

function InvoiceIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8l-5-5Z" strokeLinejoin="round"/><path d="M14 3v5h5M8 12h8M8 16h5" strokeLinecap="round"/></svg>
}

function displayDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function SalesInvoiceListPage({ supportDocument = false, creditNote = false, debitNote = false, adjustmentNote = false }: { supportDocument?: boolean; creditNote?: boolean; debitNote?: boolean; adjustmentNote?: boolean }) {
  const newPath = debitNote ? '/nota-debito/nueva' : adjustmentNote ? '/nota-ajuste/nueva' : creditNote ? '/nota-credito/nueva' : supportDocument ? '/documento-soporte/nuevo' : '/factura-venta/nueva'
  const plural = debitNote ? 'notas débito' : adjustmentNote ? 'notas de ajuste' : creditNote ? 'notas crédito' : supportDocument ? 'documentos soporte' : 'facturas'
  const newLabel = debitNote ? 'Nueva nota débito' : adjustmentNote ? 'Nueva nota de ajuste' : creditNote ? 'Nueva nota crédito' : supportDocument ? 'Nuevo documento soporte' : 'Nueva factura'
  const codeLabel = (creditNote || debitNote) ? 'CUDE' : (supportDocument || adjustmentNote) ? 'CUDS' : 'CUFE'
  const isNoteList = creditNote || debitNote || adjustmentNote
  const partyLabel = supportDocument || adjustmentNote ? 'Proveedor' : 'Cliente'
  const [search, setSearch] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [filters, setFilters] = useState({ search: '', from: '', to: '', page: 1 })
  const [revision, setRevision] = useState(0)
  const cached = peekCachedQuery<JarvisSalesInvoiceList>(jarvisHistoryQueryKey(debitNote ? 'debit' : adjustmentNote ? 'adjustment' : creditNote ? 'credit' : supportDocument))
  const refreshRequested = useRef(false)
  const [data, setData] = useState<JarvisSalesInvoiceList>(() => cached ?? { items: [], total: 0, page: 1, pageSize: 20 })
  const [isLoading, setIsLoading] = useState(!cached)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const isSalesInvoice = !supportDocument && !creditNote && !debitNote && !adjustmentNote
  const showNoteActions = isSalesInvoice || supportDocument
  const listPath = debitNote ? '/nota-debito' : adjustmentNote ? '/nota-ajuste' : creditNote ? '/nota-credito' : supportDocument ? '/documento-soporte' : '/factura-venta'
  const documentLabel = debitNote ? 'nota débito' : adjustmentNote ? 'nota de ajuste' : creditNote ? 'nota crédito' : supportDocument ? 'documento' : 'factura'

  useEffect(() => {
    let active = true
    const fetchHistory = debitNote ? fetchJarvisDebitNotes : adjustmentNote ? fetchJarvisSupportCreditNotes : creditNote ? fetchJarvisCreditNotes : supportDocument ? fetchJarvisSupportInvoices : fetchJarvisSalesInvoices
    const force = refreshRequested.current
    refreshRequested.current = false
    fetchHistory(filters, { force }).then((response) => {
      if (active) setData(response)
    }).catch((failure) => {
      if (active) setError(getApiErrorMessage(failure, 'No pudimos cargar el historial. Intenta nuevamente.'))
    }).finally(() => { if (active) setIsLoading(false) })
    return () => { active = false }
  }, [filters, revision, supportDocument, creditNote, debitNote, adjustmentNote])

  const reload = () => { refreshRequested.current = true; setIsLoading(true); setError(null); setRevision((current) => current + 1) }
  const applyFilters = (event: FormEvent) => {
    event.preventDefault()
    if (from && to && from > to) { setError('La fecha inicial no puede ser posterior a la fecha final.'); return }
    setIsLoading(true); setError(null); setExpandedId(null)
    setFilters({ search: search.trim(), from, to, page: 1 })
  }
  const clearFilters = () => {
    setSearch(''); setFrom(''); setTo(''); setError(null); setIsLoading(true); setExpandedId(null)
    setFilters({ search: '', from: '', to: '', page: 1 })
  }
  const changePage = (page: number) => {
    setIsLoading(true); setError(null); setExpandedId(null)
    setFilters((current) => ({ ...current, page }))
  }
  const hasFilters = Boolean(filters.search || filters.from || filters.to)
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize))

  return <main className="sales-history integration-page">
    <PageHeader
      title={debitNote ? 'Notas débito' : adjustmentNote ? 'Notas de ajuste' : creditNote ? 'Notas crédito' : supportDocument ? 'Documentos soporte' : 'Facturas de venta'}
      description={`Consulta tus ${plural} y crea ${supportDocument ? 'uno nuevo' : 'una nueva'} cuando lo necesites.`}
      actions={<Link className="sales-history__new" to={newPath}>{newLabel}</Link>}
    />

    <section className="sales-history__card integration-card" aria-label={`Historial de ${plural}`}>
      <div className="sales-history__heading integration-card-header">
        <div><h2>{isNoteList ? 'Notas enviadas' : supportDocument ? 'Documentos enviados' : 'Facturas enviadas'} <span className="sales-history__count">{isLoading || error ? '—' : data.total}</span></h2><p>Los envíos más recientes aparecen primero.</p></div>
        <Button variant="outline" className="sales-history__refresh" type="button" disabled={isLoading} onClick={reload}>↻ Actualizar</Button>
      </div>

      <form className="sales-history__filters integration-filters" onSubmit={applyFilters}>
        <label className="sales-history__search">Buscar documento<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={(creditNote || debitNote) ? "Número, cliente, documento o CUDE" : (supportDocument || adjustmentNote) ? "Número, proveedor, documento o CUDS" : "Número, cliente, documento o CUFE"} /></label>
        <label>Desde<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} max={to || undefined} /></label>
        <label>Hasta<input type="date" value={to} onChange={(event) => setTo(event.target.value)} min={from || undefined} /></label>
        <Button type="submit" variant="primary" disabled={isLoading}>Buscar</Button>
        {hasFilters && <Button type="button" variant="ghost" disabled={isLoading} onClick={clearFilters}>Limpiar</Button>}
      </form>

      <div aria-live="polite" aria-busy={isLoading}>
        {error ? <div className="sales-history__empty"><ErrorMessage message={error} /><Button variant="outline" onClick={reload}>Reintentar</Button></div>
          : isLoading ? <div className="sales-history__loading"><LoadingIndicator message="Cargando historial..." /></div>
          : data.items.length === 0 ? <div className="sales-history__empty">
            <span className="sales-history__empty-icon"><InvoiceIcon /></span>
            <h3>{hasFilters ? `No encontramos ${plural} con esos filtros` : 'Tu historial comienza aquí'}</h3>
            <p>{hasFilters ? `Prueba otro número, tercero, ${codeLabel} o rango de fechas.` : 'Los próximos envíos aparecerán en este listado.'}</p>
            {hasFilters ? <Button variant="outline" onClick={clearFilters}>Limpiar filtros</Button> : <Link className="sales-history__new" to={newPath}>{newLabel}</Link>}
          </div> : <>
            <div className="sales-history__table-wrap"><table className="integration-table">
              <thead><tr><th>{debitNote ? 'Nota débito' : adjustmentNote ? 'Nota de ajuste' : creditNote ? 'Nota crédito' : supportDocument ? 'Documento soporte' : 'Factura'}</th><th>Fecha de emisión</th><th>{partyLabel}</th><th className="sales-history__amount">Total</th><th>Estado</th><th>Acciones</th></tr></thead>
              <tbody>{data.items.map((invoice) => <tr key={invoice.id}>
                <td><strong className="sales-history__number">{invoice.prefix}{invoice.number.startsWith(invoice.prefix) ? invoice.number.slice(invoice.prefix.length) : invoice.number}</strong>
                  {invoice.cufe && <><button type="button" className="sales-history__detail" aria-expanded={expandedId === invoice.id} onClick={() => setExpandedId(expandedId === invoice.id ? null : invoice.id)}>{expandedId === invoice.id ? `Ocultar ${codeLabel}` : `Ver ${codeLabel}`}</button>{expandedId === invoice.id && <p className="sales-history__cufe">{invoice.cufe}</p>}</>}
                </td>
                <td>{displayDate(invoice.issueDate)}</td>
                <td><strong>{invoice.customerName}</strong><span className="sales-history__muted">{invoice.customerIdentification}</span></td>
                <td className="sales-history__amount"><strong>{Number(invoice.total).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong><span className="sales-history__muted">{invoice.currency}</span></td>
                <td><span className="sales-history__status"><span aria-hidden="true">✓</span> {supportDocument ? 'Enviado' : 'Enviada'} a DIAN</span></td>
                <td><div className="sales-history__actions">
                  <Link className="sales-history__view" to={`${listPath}/${encodeURIComponent(invoice.id)}/visualizar`} aria-label={`Visualizar ${documentLabel} ${invoice.prefix}${invoice.number}`}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg> Visualizar
                  </Link>
                  {showNoteActions && <InvoiceNoteActions supportDocument={supportDocument} invoiceId={invoice.id} number={invoice.number.startsWith(invoice.prefix) ? invoice.number : `${invoice.prefix}${invoice.number}`} />}
                </div></td>
              </tr>)}</tbody>
            </table></div>
            {data.total > 10 && <footer className="sales-history__pagination"><span>{(data.page - 1) * data.pageSize + 1}–{Math.min(data.page * data.pageSize, data.total)} de {data.total} {plural}</span><div><button type="button" disabled={data.page <= 1} onClick={() => changePage(data.page - 1)}>Anterior</button><span>{data.page} / {pages}</span><button type="button" disabled={data.page >= pages} onClick={() => changePage(data.page + 1)}>Siguiente</button></div></footer>}
          </>}
      </div>
    </section>
  </main>
}
