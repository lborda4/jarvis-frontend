import { useEffect, useState } from 'react'
import { fetchCommissionReport, registerAdvisorSalePayment } from '../services/advisorService'
import { getApiErrorMessage } from '../services/apiClient'
import type { AdvisorSale, CommissionReportData } from '../types/advisor'
import { formatCop } from '../utils/adminPlan'
import { shouldShowTablePagination } from '../utils/tablePagination'
import { commercialSalesCsv, filterCommercialSales } from '../utils/commercialDashboard'
import Button from './Button'
import ErrorMessage from './ErrorMessage'
import LoadingIndicator from './LoadingIndicator'
import SuccessMessage from './SuccessMessage'
import './CommissionReport.css'
import './BusinessDashboard.css'

const currentMonth = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit' }).format(new Date())
export function CommissionSalesTable({ rows, admin = false, busy = false, onPay }: { rows: AdvisorSale[]; admin?: boolean; busy?: boolean; onPay?: (id: string) => void }) {
  const [page, setPage] = useState(1)
  const pages = Math.max(1, Math.ceil(rows.length / 10)), current = Math.min(page, pages)
  return <><div className="commission-report__table"><table><thead><tr><th>Cliente / asesor</th><th>Producto</th><th>Venta</th><th>Comisión</th><th>Pago</th></tr></thead><tbody>{rows.slice((current - 1) * 10, current * 10).map(item => <tr key={item.id}>
    <td data-label="Cliente / asesor">{item.companyName}<small>NIT {item.companyNit} · {item.advisorName}</small></td>
    <td data-label="Producto">{item.productName}<small>{item.provider} · {item.kind === 'PLAN' ? item.commissionStage === 'RENEWAL' ? 'Renovación' : 'Plan' : 'Recarga'}</small></td>
    <td data-label="Venta">{formatCop(item.priceCop)}</td><td data-label="Comisión">{formatCop(item.commissionCop)}<small>{item.commissionRate.toLocaleString('es-CO')} %</small></td>
    <td data-label="Pago">{item.paidAt ? new Date(item.paidAt).toLocaleDateString('es-CO', { timeZone: 'America/Bogota' }) : admin ? <Button size="sm" variant="outline" disabled={busy} onClick={() => onPay?.(item.id)}>Registrar pago</Button> : 'Pendiente'}</td>
  </tr>)}{!rows.length && <tr><td colSpan={5}>No hay ventas para mostrar.</td></tr>}</tbody></table></div>
    {shouldShowTablePagination(rows.length) && <div className="commission-report__pages"><Button variant="outline" disabled={current === 1} onClick={() => setPage(current - 1)}>Anterior</Button><span>{current} / {pages}</span><Button variant="outline" disabled={current === pages} onClick={() => setPage(current + 1)}>Siguiente</Button></div>}</>
}
export default function CommissionReport({ admin = false, advisorId, companyId, pendingOnly = false, onPaid }: { admin?: boolean; advisorId?: string; companyId?: string; pendingOnly?: boolean; onPaid?: () => void }) {
  const [month, setMonth] = useState(currentMonth)
  const [data, setData] = useState<CommissionReportData | null>(null)
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false)
  const [error, setError] = useState(''), [notice, setNotice] = useState('')
  const [revision, setRevision] = useState(0)
  const [search, setSearch] = useState(''), [provider, setProvider] = useState(''), [kind, setKind] = useState('')
  const [view, setView] = useState<'all' | 'paid' | 'pending'>('all')
  useEffect(() => {
    let cancelled = false
    void fetchCommissionReport(month, admin, { advisorId, companyId }).then(value => { if (!cancelled) setData(value) }).catch(failure => { if (!cancelled) setError(getApiErrorMessage(failure, 'No se pudieron cargar las comisiones.')) }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [month, admin, advisorId, companyId, revision])
  const pay = async (id: string) => {
    if (busy) return
    setBusy(true); setError(''); setNotice('')
    try { const result = await registerAdvisorSalePayment(id); setNotice(result.message); setLoading(true); setData(null); setRevision(value => value + 1); onPaid?.() }
    catch (failure) { setError(getApiErrorMessage(failure, 'No se pudo registrar el pago.')) }
    finally { setBusy(false) }
  }
  const paid = filterCommercialSales(data?.paid ?? [], search, provider, kind)
  const pending = filterCommercialSales(data?.pending ?? [], search, provider, kind)
  const visible = pendingOnly || view === 'pending' ? pending : view === 'paid' ? paid : [...paid, ...pending]
  const exportCsv = () => {
    const url = URL.createObjectURL(new Blob([commercialSalesCsv(visible)], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `ventas-comisiones-${month}.csv`; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return <section className="admin-card commission-report"><div className="commission-report__heading"><h2>{pendingOnly ? 'Ventas pendientes de pago' : 'Comisiones mensuales'}</h2>{!pendingOnly && <label>Mes<input type="month" value={month} disabled={busy} min="2000-01" max="2099-12" onChange={event => { if (event.target.value) { setMonth(event.target.value); setLoading(true); setData(null); setError('') } }} /></label>}</div>
    {error && <><ErrorMessage inline message={error} /><Button variant="outline" onClick={() => { setError(''); setLoading(true); setRevision(value => value + 1) }}>Reintentar</Button></>}{notice && <SuccessMessage message={notice} />}
    {loading ? <LoadingIndicator message="Cargando comisiones…" /> : data && <>
      <div className="business-filters"><label className="admin-form__field">Buscar venta<input type="search" placeholder="Cliente, NIT, asesor o producto" value={search} onChange={event => setSearch(event.target.value)} /></label><label className="admin-form__field">Integración<select value={provider} onChange={event => setProvider(event.target.value)}><option value="">Todas</option><option value="JARVIS">Jarvis</option><option value="SIIGO">Siigo</option></select></label><label className="admin-form__field">Producto<select value={kind} onChange={event => setKind(event.target.value)}><option value="">Planes y recargas</option><option value="PLAN">Planes</option><option value="TOP_UP">Recargas</option></select></label><Button variant="outline" disabled={!visible.length || busy} onClick={exportCsv}>Exportar Excel (CSV)</Button></div>
      {!pendingOnly && <><div className="commission-report__totals"><span>Ventas pagadas <strong>{formatCop(paid.reduce((sum, sale) => sum + sale.priceCop, 0))}</strong></span><span>Comisión del mes <strong>{formatCop(paid.reduce((sum, sale) => sum + sale.commissionCop, 0))}</strong></span><span>Pendiente de cobro <strong>{formatCop(pending.reduce((sum, sale) => sum + sale.priceCop, 0))}</strong></span></div>
        {admin && !advisorId && !companyId && !search && !provider && !kind && data.summary.length > 0 && <ul className="commission-report__summary">{data.summary.map(item => <li key={item.advisorId}><span>{item.advisorName}</span><strong>{formatCop(item.commissionCop)}</strong></li>)}</ul>}
        <div className="business-actions commission-report__views" aria-label="Estado del pago">{([{ id: 'all', label: 'Todas' }, { id: 'paid', label: `Pagadas (${paid.length})` }, { id: 'pending', label: `Pendientes (${pending.length})` }] as const).map(item => <Button key={item.id} variant={view === item.id ? 'primary' : 'outline'} aria-pressed={view === item.id} onClick={() => setView(item.id)}>{item.label}</Button>)}</div>
        {view !== 'pending' && <><h3>Pagadas en {month}</h3><CommissionSalesTable key={`paid:${month}:${search}:${provider}:${kind}`} rows={paid} /></>}
        {view !== 'paid' && <h3>Pendientes de pago</h3>}</>}
      {(pendingOnly || view !== 'paid') && <><p className="commission-report__hint">La comisión se causa al registrar el pago.</p><CommissionSalesTable key={`pending:${search}:${provider}:${kind}`} rows={pending} admin={admin} busy={busy} onPay={id => void pay(id)} /></>}
    </>}
  </section>
}
