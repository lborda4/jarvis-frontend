import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import Button from '../components/Button'
import ErrorMessage from '../components/ErrorMessage'
import JarvisReportResults from '../components/JarvisReportResults'
import LoadingIndicator from '../components/LoadingIndicator'
import PageHeader from '../components/PageHeader'
import { useAuth } from '../context/AuthContext'
import { useIntegrationSetup } from '../context/IntegrationSetupContext'
import { getApiErrorMessage } from '../services/apiClient'
import { exportJarvisReport, fetchJarvisReport, type JarvisReportFilters, type JarvisReportResult } from '../services/jarvisReportsService'
import './JarvisReportsPage.css'

const reportOptions = [
  ['sales', 'Ventas generales'], ['customers', 'Ventas por cliente'], ['products', 'Ventas por producto'], ['sellers', 'Ventas por vendedor'], ['taxes', 'Impuestos y retenciones'],
] as const
function initialFilters(): JarvisReportFilters {
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  return { report: 'sales', view: 'summary', from: `${today.slice(0, 7)}-01`, to: today, customer: '', seller: '', product: '', kind: '', currency: 'COP', page: 1, pageSize: 20 }
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
      .then(result => { if (!controller.signal.aborted) setEntry({ key: requestKey, data: result, error: '' }) })
      .catch(reason => { if (!controller.signal.aborted) setEntry({ key: requestKey, data: null, error: getApiErrorMessage(reason, 'No se pudo consultar el reporte.') }) })
    return () => controller.abort()
  }, [companyId, filters, isCheckingSetup, isJarvisCompany, requestKey])

  const consult = (event: FormEvent) => {
    event.preventDefault()
    setFilters({ ...draft, currency: draft.currency.trim().toUpperCase(), view: filters.view, pageSize: filters.pageSize, page: 1 })
    setAttempt(value => value + 1)
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
    <PageHeader eyebrow="JARVIS" title="Reportes" description="Consulta ventas, devoluciones, impuestos y retenciones del historial registrado de tu empresa." actions={<Button disabled={!data || exporting || loading} onClick={() => void download()}>{exporting ? 'Generando Excel…' : 'Exportar a Excel'}</Button>} />
    <form className="integration-card jarvis-reports__filters" onSubmit={consult}>
      <label>Reporte<select value={draft.report} onChange={event => setDraft({ ...draft, report: event.target.value as JarvisReportFilters['report'], kind: '' })}>{reportOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Desde<input type="date" required value={draft.from} max={draft.to || undefined} onChange={event => setDraft({ ...draft, from: event.target.value })} /></label>
      <label>Hasta<input type="date" required value={draft.to} min={draft.from || undefined} onChange={event => setDraft({ ...draft, to: event.target.value })} /></label>
      <label>{draft.report === 'taxes' ? 'Cliente / proveedor' : 'Cliente'}<input value={draft.customer} maxLength={200} placeholder="Identificación o nombre" onChange={event => setDraft({ ...draft, customer: event.target.value })} /></label>
      <label>Vendedor<input value={draft.seller} maxLength={200} placeholder="Nombre del vendedor" onChange={event => setDraft({ ...draft, seller: event.target.value })} /></label>
      <label>Producto o servicio<input value={draft.product} maxLength={200} placeholder="Código o descripción" onChange={event => setDraft({ ...draft, product: event.target.value })} /></label>
      <label>Tipo de comprobante<select value={draft.kind} onChange={event => setDraft({ ...draft, kind: event.target.value })}>
        <option value="">Todos</option><option value="ELECTRONIC_INVOICE">Factura de venta</option><option value="CREDIT_NOTE">Nota crédito</option><option value="DEBIT_NOTE">Nota débito</option>
        {draft.report === 'taxes' && <><option value="SUPPORT_DOCUMENT">Documento soporte</option><option value="SUPPORT_CREDIT_NOTE">Nota de ajuste</option></>}
      </select></label>
      <label>Moneda<input value={draft.currency} maxLength={3} pattern="[A-Za-z]{3}|^$" placeholder="Todas" onChange={event => setDraft({ ...draft, currency: event.target.value })} /></label>
      <div className="jarvis-reports__filter-actions"><Button type="submit" disabled={loading}>Consultar</Button><Button variant="outline" onClick={() => { const reset = initialFilters(); setDraft(reset); setFilters(reset); setAttempt(value => value + 1) }}>Limpiar filtros</Button></div>
    </form>
    <div className="jarvis-reports__view"><h2>{reportOptions.find(([value]) => value === filters.report)?.[1]}</h2><div role="group" aria-label="Vista del reporte">{(['summary', 'detail'] as const).map(view => <Button key={view} variant={filters.view === view ? 'primary' : 'outline'} aria-pressed={filters.view === view} onClick={() => setFilters({ ...filters, view, page: 1 })}>{view === 'summary' ? 'Consolidado' : 'Registros individuales'}</Button>)}</div></div>
    <p className="jarvis-reports__period">Período consultado: {filters.from} a {filters.to}. La exportación incluye todos los registros filtrados, sus consolidados y totales por moneda.</p>
    {loading && <LoadingIndicator message="Consultando registros…" />}
    {error && <ErrorMessage message={error} />}
    {exportError?.key === requestKey && <ErrorMessage message={exportError.message} />}
    {data && <JarvisReportResults data={data} onPage={page => setFilters({ ...filters, page })} onPageSize={pageSize => setFilters({ ...filters, pageSize, page: 1 })} />}
  </main>
}
