import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import Button from '../components/Button'
import ErrorMessage from '../components/ErrorMessage'
import JarvisReportResults from '../components/JarvisReportResults'
import LoadingIndicator from '../components/LoadingIndicator'
import DateRangeFilter from '../components/DateRangeFilter'
import { CalendarIcon, InvoiceIcon } from '../components/icons/SidebarIcons'
import { useAuth } from '../context/AuthContext'
import { useIntegrationSetup } from '../context/IntegrationSetupContext'
import { getApiErrorMessage } from '../services/apiClient'
import { exportJarvisReport, fetchJarvisReport, type JarvisReportFilters, type JarvisReportResult } from '../services/jarvisReportsService'
import './JarvisReportsPage.css'

const reportOptions = [
  ['sales', 'Ventas'], ['customers', 'Ventas por cliente'], ['products', 'Ventas por producto'], ['sellers', 'Ventas por vendedor'], ['taxes', 'Impuestos y retenciones'],
] as const
function initialFilters(): JarvisReportFilters {
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  return { report: 'sales', view: 'detail', from: `${today.slice(0, 7)}-01`, to: today, search: '', customer: '', seller: '', product: '', kind: '', currency: 'COP', page: 1, pageSize: 10 }
}

export default function JarvisReportsPage() {
  const { user } = useAuth()
  const { isCheckingSetup, isJarvisCompany, setupPath } = useIntegrationSetup()
  const companyId = user?.company?.id ?? ''
  const [filters, setFilters] = useState(initialFilters)
  const [draft, setDraft] = useState(filters)
  const [attempt, setAttempt] = useState(0)
  const [entry, setEntry] = useState<{ key: string; data: JarvisReportResult | null; error: string } | null>(null)
  const [exporting, setExporting] = useState(false)
  const [moreFilters, setMoreFilters] = useState(false)
  const [exportError, setExportError] = useState<{ key: string; message: string } | null>(null)
  const requestKey = JSON.stringify([user?.id, companyId, filters, attempt])
  const currentKey = useRef(requestKey)
  useLayoutEffect(() => {
    currentKey.current = requestKey
    return () => { currentKey.current = '' }
  }, [requestKey])
  const data = entry?.key === requestKey ? entry.data : null
  const error = entry?.key === requestKey ? entry.error : ''
  const loading = entry?.key !== requestKey

  useEffect(() => {
    if (!isJarvisCompany || isCheckingSetup || !companyId) return
    const controller = new AbortController()
    void fetchJarvisReport(filters, controller.signal)
      .then(result => {
        if (controller.signal.aborted) return
        if (result.page !== filters.page) { setFilters(current => ({ ...current, page: result.page })); return }
        setEntry({ key: requestKey, data: result, error: '' })
      })
      .catch(reason => { if (!controller.signal.aborted) setEntry({ key: requestKey, data: null, error: getApiErrorMessage(reason, 'No se pudo consultar el reporte.') }) })
    return () => controller.abort()
  }, [companyId, filters, isCheckingSetup, isJarvisCompany, requestKey])

  const consult = (event: FormEvent) => {
    event.preventDefault()
    setFilters({ ...draft, currency: draft.currency.trim().toUpperCase(), view: filters.view, pageSize: filters.pageSize, page: 1 })
    setAttempt(value => value + 1)
  }
  const selectReport = (report: JarvisReportFilters['report']) => {
    const next = { ...initialFilters(), report, from: filters.from, to: filters.to }
    setDraft(next); setFilters(next)
  }
  const clearFilters = () => {
    const next = { ...initialFilters(), report: filters.report, view: filters.view, from: filters.from, to: filters.to, pageSize: filters.pageSize }
    setDraft(next); setFilters(next); setAttempt(value => value + 1)
  }
  const title = reportOptions.find(([value]) => value === filters.report)?.[1] ?? 'Reportes'
  const descriptions: Record<JarvisReportFilters['report'], string> = {
    sales: 'Consulta el detalle de todas tus ventas, notas crédito, notas débito, impuestos a cargo y retenciones.',
    products: 'Consulta el detalle de tus ventas por producto, con el cliente, vendedor y número de comprobante.',
    customers: 'Consulta las ventas y devoluciones registradas para cada cliente.',
    sellers: 'Consulta las ventas y devoluciones atribuidas a cada vendedor.',
    taxes: 'Consulta el detalle de impuestos a cargo y retenciones por comprobante.',
  }
  const download = async () => {
    if (exporting || !data) return
    const exportKey = requestKey
    setExporting(true); setExportError(null)
    try {
      const blob = await exportJarvisReport(filters)
      if (currentKey.current !== exportKey) return
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url; anchor.download = `JARVIS-${filters.report}-${filters.from}-${filters.to}.xlsx`
      document.body.appendChild(anchor); anchor.click(); anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch {
      if (currentKey.current === exportKey) setExportError({ key: exportKey, message: 'No se pudo exportar el reporte. Intenta nuevamente.' })
    } finally { setExporting(false) }
  }

  if (isCheckingSetup) return <LoadingIndicator message="Cargando reportes…" />
  if (!isJarvisCompany) return <Navigate to={setupPath} replace />
  return <main className="jarvis-reports integration-page">
    <nav className="jarvis-reports__breadcrumb" aria-label="Ubicación">Reportes <span aria-hidden="true">›</span> {title}</nav>
    <div className="jarvis-reports__selector"><label htmlFor="jarvis-report-select">Seleccionar reporte</label><select id="jarvis-report-select" value={filters.report} onChange={event => selectReport(event.target.value as JarvisReportFilters['report'])}>{reportOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
    <header className="jarvis-reports__header"><div><h1>{title}</h1><p>{descriptions[filters.report]}</p></div><div className="jarvis-reports__header-actions"><div className="jarvis-reports__dates"><CalendarIcon /><DateRangeFilter from={filters.from} to={filters.to} onApply={range => {
      const next = { ...filters, from: range.dateFrom ?? initialFilters().from, to: range.dateTo ?? initialFilters().to, page: 1 }
      setFilters(next); setDraft(current => ({ ...current, from: next.from, to: next.to }))
    }} /></div><Button disabled={!data || exporting || loading} onClick={() => void download()}><InvoiceIcon />{exporting ? 'Generando Excel…' : 'Exportar a Excel'}</Button></div></header>
    <form className="integration-card jarvis-reports__filters" onSubmit={consult}>
      {draft.report === 'sales' ? <label>Buscar por cliente, número o identificación<input type="search" value={draft.search ?? ''} maxLength={200} placeholder="Buscar…" onChange={event => setDraft({ ...draft, search: event.target.value })} /></label> : <label>Buscar por producto<input value={draft.product} maxLength={200} placeholder="Buscar por código o nombre…" onChange={event => setDraft({ ...draft, product: event.target.value })} /></label>}
      <label>{draft.report === 'taxes' ? 'Cliente / proveedor' : 'Cliente'}<input value={draft.customer} maxLength={200} placeholder="Identificación o nombre" onChange={event => setDraft({ ...draft, customer: event.target.value })} /></label>
      <label>Vendedor<input value={draft.seller} maxLength={200} placeholder="Nombre del vendedor" onChange={event => setDraft({ ...draft, seller: event.target.value })} /></label>
      <label>Tipo de comprobante<select value={draft.kind} onChange={event => setDraft({ ...draft, kind: event.target.value })}>
        <option value="">Todos</option><option value="ELECTRONIC_INVOICE">Factura de venta</option><option value="CREDIT_NOTE">Nota crédito</option><option value="DEBIT_NOTE">Nota débito</option>
        {draft.report === 'taxes' && <><option value="SUPPORT_DOCUMENT">Documento soporte</option><option value="SUPPORT_CREDIT_NOTE">Nota de ajuste</option></>}
      </select></label>
      {draft.report === 'sales' && <><label>Fecha inicial<input type="date" required value={draft.from} max={draft.to || undefined} onChange={event => setDraft({ ...draft, from: event.target.value })} /></label><label>Fecha final<input type="date" required value={draft.to} min={draft.from || undefined} onChange={event => setDraft({ ...draft, to: event.target.value })} /></label></>}
      {moreFilters && <div id="jarvis-reports-more-filters" className="jarvis-reports__advanced"><label>Moneda<input value={draft.currency} maxLength={3} pattern="[A-Za-z]{3}|^$" placeholder="Todas" onChange={event => setDraft({ ...draft, currency: event.target.value })} /></label></div>}
      <div className="jarvis-reports__filter-actions"><Button variant="outline" aria-expanded={moreFilters} aria-controls="jarvis-reports-more-filters" onClick={() => setMoreFilters(value => !value)}>☷ Más filtros</Button><Button type="submit" disabled={loading}>Consultar</Button><Button className="jarvis-reports__clear" variant="ghost" onClick={clearFilters}>↻ Limpiar filtros</Button></div>
    </form>
    <div className="jarvis-reports__view"><span>Vista del reporte</span><div role="group" aria-label="Vista del reporte">{(['detail', 'summary'] as const).map(view => <Button key={view} variant={filters.view === view ? 'primary' : 'outline'} aria-pressed={filters.view === view} onClick={() => setFilters({ ...filters, view, page: 1 })}>{view === 'summary' ? 'Consolidado' : 'Registros individuales'}</Button>)}</div></div>
    <p className="jarvis-reports__period">Período consultado: {filters.from} a {filters.to}. La exportación incluye todos los registros filtrados, sus consolidados y totales por moneda.</p>
    {loading && <LoadingIndicator message="Consultando registros…" />}
    {error && <ErrorMessage message={error} />}
    {exportError?.key === requestKey && <ErrorMessage message={exportError.message} />}
    {data && <JarvisReportResults key={`${filters.report}:${filters.view}`} data={data} onPage={page => setFilters({ ...filters, page })} onPageSize={pageSize => setFilters({ ...filters, pageSize, page: 1 })} />}
  </main>
}
