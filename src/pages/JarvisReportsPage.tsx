import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import Button from '../components/Button'
import ErrorMessage from '../components/ErrorMessage'
import JarvisReportResults from '../components/JarvisReportResults'
import LoadingIndicator from '../components/LoadingIndicator'
import DateRangeFilter from '../components/DateRangeFilter'
import ReportFilterCombobox from '../components/ReportFilterCombobox'
import { CalendarIcon, InvoiceIcon } from '../components/icons/SidebarIcons'
import { useAuth } from '../context/AuthContext'
import { useIntegrationSetup } from '../context/IntegrationSetupContext'
import { getApiErrorMessage } from '../services/apiClient'
import { exportJarvisReport, fetchJarvisReport, fetchJarvisReportSuggestions, JARVIS_REPORT_TAX_OPTIONS, type JarvisReportFilters, type JarvisReportResult, type JarvisReportSuggestions } from '../services/jarvisReportsService'
import './JarvisReportsPage.css'

const reportOptions = [
  ['sales', 'Ventas'], ['customers', 'Ventas por cliente'], ['products', 'Ventas por producto'], ['sellers', 'Ventas por vendedor'], ['taxes', 'Impuestos y retenciones'],
] as const
function initialFilters(): JarvisReportFilters {
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  return { report: 'sales', view: 'detail', from: `${today.slice(0, 7)}-01`, to: today, search: '', customer: '', seller: '', product: '', tax: '', kind: '', currency: '', page: 1, pageSize: 10 }
}

export default function JarvisReportsPage() {
  const { user } = useAuth()
  const { isCheckingSetup, isJarvisCompany, setupPath } = useIntegrationSetup()
  const companyId = user?.company?.id ?? ''
  const [filters, setFilters] = useState(initialFilters)
  const [draft, setDraft] = useState(filters)
  const [suggestionAttempt, setSuggestionAttempt] = useState(0)
  const suggestionKey = JSON.stringify([user?.id, companyId, draft.report, draft.from, draft.to, draft.kind, suggestionAttempt])
  const [suggestionEntry, setSuggestionEntry] = useState<{ key: string; data: JarvisReportSuggestions | null; failed: boolean } | null>(null)
  const suggestions = suggestionEntry?.key === suggestionKey ? suggestionEntry.data : null
  const [attempt, setAttempt] = useState(0)
  const [entry, setEntry] = useState<{ key: string; data: JarvisReportResult | null; error: string } | null>(null)
  const [exporting, setExporting] = useState(false)
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
    if (!isJarvisCompany || isCheckingSetup || !companyId || !draft.from || !draft.to || draft.from > draft.to) return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      void fetchJarvisReportSuggestions({ report: draft.report, from: draft.from, to: draft.to, kind: draft.kind }, controller.signal)
        .then(data => { if (!controller.signal.aborted) setSuggestionEntry({ key: suggestionKey, data, failed: false }) })
        .catch(() => { if (!controller.signal.aborted) setSuggestionEntry({ key: suggestionKey, data: null, failed: true }) })
    }, 250)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [companyId, draft.report, draft.from, draft.to, draft.kind, isCheckingSetup, isJarvisCompany, suggestionKey])

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
    setFilters({ ...draft, view: filters.view, pageSize: filters.pageSize, page: 1 })
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
    <form className={`integration-card jarvis-reports__filters${draft.report === 'customers' ? ' jarvis-reports__filters--customers' : ''}`} onSubmit={consult}>
      {draft.report === 'taxes' && <label>Impuesto<select value={draft.tax ?? ''} onChange={event => setDraft({ ...draft, tax: event.target.value })}>
        <option value="">Todos</option>{JARVIS_REPORT_TAX_OPTIONS.map(tax => <option key={tax.value} value={tax.value}>{tax.label}</option>)}
      </select></label>}
      {([
        ...(['customers', 'taxes'].includes(draft.report) ? [] : draft.report === 'sales'
          ? [{ field: 'search' as const, options: 'search' as const, label: 'Buscar por cliente, número o identificación', placeholder: 'Buscar…' }]
          : [{ field: 'product' as const, options: 'products' as const, label: 'Buscar por producto', placeholder: 'Buscar por código o nombre…' }]),
        { field: 'customer' as const, options: 'customers' as const, label: draft.report === 'taxes' ? 'Cliente / proveedor' : 'Cliente', placeholder: 'Identificación o nombre' },
        ...(draft.report === 'customers' ? [] : [{ field: 'seller' as const, options: 'sellers' as const, label: 'Vendedor', placeholder: 'Nombre del vendedor' }]),
      ]).map(config => <ReportFilterCombobox key={`${companyId}:${draft.report}:${config.field}`} label={config.label}
        value={draft[config.field] ?? ''} options={suggestions?.[config.options] ?? []} placeholder={config.placeholder}
        loading={suggestionEntry?.key !== suggestionKey} failed={suggestionEntry?.key === suggestionKey && suggestionEntry.failed}
        onChange={value => setDraft(current => ({ ...current, [config.field]: value }))} />)}
      <label>Tipo de comprobante<select value={draft.kind} onChange={event => setDraft({ ...draft, kind: event.target.value })}>
        <option value="">Todos</option><option value="ELECTRONIC_INVOICE">Factura de venta</option><option value="CREDIT_NOTE">Nota crédito</option><option value="DEBIT_NOTE">Nota débito</option>
        {draft.report === 'taxes' && <><option value="SUPPORT_DOCUMENT">Documento soporte</option><option value="SUPPORT_CREDIT_NOTE">Nota de ajuste</option></>}
      </select></label>
      {draft.report === 'sales' && <><label>Fecha inicial<input type="date" required value={draft.from} max={draft.to || undefined} onChange={event => setDraft({ ...draft, from: event.target.value })} /></label><label>Fecha final<input type="date" required value={draft.to} min={draft.from || undefined} onChange={event => setDraft({ ...draft, to: event.target.value })} /></label></>}
      <div className="jarvis-reports__filter-actions"><Button type="submit" disabled={loading}>Consultar</Button><Button className="jarvis-reports__clear" variant="ghost" onClick={clearFilters}>↻ Limpiar filtros</Button></div>
      {suggestionEntry?.key === suggestionKey && suggestionEntry.failed && <p className="jarvis-reports__suggestions-status" role="status">No pudimos cargar las sugerencias. Puedes escribir el filtro y consultar. <Button variant="ghost" onClick={() => setSuggestionAttempt(value => value + 1)}>Reintentar sugerencias</Button></p>}
    </form>
    <div className="jarvis-reports__view"><span>Vista del reporte</span><div role="group" aria-label="Vista del reporte">{(['detail', 'summary'] as const).map(view => <Button key={view} variant={filters.view === view ? 'primary' : 'outline'} aria-pressed={filters.view === view} onClick={() => setFilters({ ...filters, view, page: 1 })}>{view === 'summary' ? 'Consolidado' : 'Registros individuales'}</Button>)}</div></div>
    <p className="jarvis-reports__period">Período consultado: {filters.from} a {filters.to}. La exportación incluye todos los registros filtrados, sus consolidados y totales por moneda.</p>
    {loading && <LoadingIndicator message="Consultando registros…" />}
    {error && <ErrorMessage message={error} />}
    {exportError?.key === requestKey && <ErrorMessage message={exportError.message} />}
    {data && <JarvisReportResults key={`${filters.report}:${filters.view}`} data={data} onPage={page => setFilters({ ...filters, page })} onPageSize={pageSize => setFilters({ ...filters, pageSize, page: 1 })} />}
  </main>
}
