import { CLIENT_STATUS_LABELS } from '../utils/clientLifecycle'
import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import type { AdminCompanyListItem } from '../types/admin'
import { shouldShowTablePagination } from '../utils/tablePagination'
import { updateCompanyTracking } from '../services/adminService'
import { getApiErrorMessage } from '../services/apiClient'
import { colombiaToday, companyTrackingStatus, TRACKING_STATUS_LABELS, trackingCsvCell, trackingDocumentBalance, trackingBillingMonths, trackingPeriodLabel, trackingRenewalDueDate, trackingDueDate, type TrackingStatus } from '../utils/companyTracking'
import Button from './Button'
import Modal from './Modal'
import ErrorMessage from './ErrorMessage'
import LoadingIndicator from './LoadingIndicator'
import './AdminTracking.css'

const dateLabel = (date: string | null | undefined) => date ? new Date(`${date.slice(0, 10)}T12:00:00`).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

function SummaryIcon({ kind }: { kind: string }) {
  return <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    {kind === 'blue' ? <><circle cx="9" cy="7" r="3" /><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 4v3" /></> : kind === 'red' ? <><path d="m12 3 10 18H2L12 3Z" /><path d="M12 9v5m0 3h.01" /></> : kind === 'teal' ? <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4m10-4v4M3 11h18m-13 5 3 3 5-5" /></> : <><circle cx="12" cy="12" r="9" /><path d="M12 7v6m0 4h.01" /></>}
  </svg>
}

export function TrackingEditor({ company, onClose, onSaved, inline = false }: { company: AdminCompanyListItem; onClose: () => void; onSaved: (company: AdminCompanyListItem) => void; inline?: boolean }) {
  const jarvis = company.integrations.find(item => item.provider === 'JARVIS')
  const [commercial, setCommercial] = useState(company.commercial ?? '')
  const [months, setMonths] = useState(String(jarvis ? jarvis.plan?.commercialTerms?.billingMonths ?? 12 : trackingBillingMonths(company) ?? 1))
  const [paymentReceived, setPaymentReceived] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    const billingMonths = Number(months)
    if (!Number.isInteger(billingMonths) || billingMonths < 1 || billingMonths > 1200) { setError('Indica una cantidad entera de meses entre 1 y 1200.'); return }
    setBusy(true); setError(null)
    try { onSaved(await updateCompanyTracking(company.id, { commercial: commercial.trim() || null, billingMonths, paymentReceived, expectedDueDate: company.subscriptionDueDate ?? null, expectedJarvisCycleId: jarvis?.jarvisDocumentCycle?.id ?? null })) }
    catch (failure) { setError(getApiErrorMessage(failure, 'No se pudo guardar el seguimiento.')) }
    finally { setBusy(false) }
  }
  const content = <>
    <h2 id="tracking-editor-title">Configurar seguimiento</h2>
    <p>{company.name}</p>
    {error && <ErrorMessage message={error} />}
    <form className="admin-form" onSubmit={submit}>
      <div className="admin-form__field"><label htmlFor="tracking-commercial">{company.advisorId ? 'Asesor asignado' : 'Comercial'}</label><input id="tracking-commercial" value={commercial} onChange={event => setCommercial(event.target.value)} maxLength={120} disabled={busy || Boolean(company.advisorId)} placeholder="Nombre del comercial" /></div>
      <div className="admin-form__field"><label htmlFor="tracking-months">Periodicidad del plan (meses)</label><input id="tracking-months" type="number" min="1" max="1200" step="1" required value={months} onChange={event => setMonths(event.target.value)} disabled={busy || Boolean(jarvis)} /><small>{jarvis ? 'Vence con el certificado digital.' : 'Por ejemplo: 3 para tres meses o 12 para un año.'}</small></div>
      <div className="admin-form__field"><label htmlFor="tracking-payment">Pago del nuevo período</label><select id="tracking-payment" value={paymentReceived ? 'paid' : 'unpaid'} onChange={event => setPaymentReceived(event.target.value === 'paid')} disabled={busy}><option value="unpaid">{company.trackingLastPaidAt ? 'No registrar un pago nuevo' : 'No, aún no ha pagado'}</option><option value="paid">Sí, ya pagó: renovar un período</option></select></div>
      <p className="tracking__muted">Vencimiento actual: {dateLabel(trackingDueDate(company))}.{company.trackingLastPaidAt && <> Último pago registrado: {dateLabel(colombiaToday(new Date(company.trackingLastPaidAt)))}.</>}</p>
      {paymentReceived ? <p className="tracking__muted" role="status">{jarvis ? 'Renueva el plan Jarvis con su cupo base y sin saldos anteriores. La vigencia se verifica con el certificado.' : <>Nuevo vencimiento: <strong>{dateLabel(trackingRenewalDueDate(company, Number(months)))}</strong>.</>}</p> : null}
      <div className="modal-dialog__actions"><Button type="button" variant="secondary" onClick={onClose} disabled={busy}>Cancelar</Button><Button type="submit" variant="primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</Button></div>
    </form>
  </>
  return inline ? <section className="admin-card">{content}</section> : <Modal isOpen onClose={onClose} busy={busy} labelledBy="tracking-editor-title">{content}</Modal>
}

export default function AdminTracking({ companies, loading, onUpdated, onCreate, initialStatus = '' }: { companies: AdminCompanyListItem[]; loading: boolean; onUpdated: (company: AdminCompanyListItem) => void; onCreate: () => void; initialStatus?: string }) {
  const [search, setSearch] = useState('')
  const [plan, setPlan] = useState('')
  const [lifecycle, setLifecycle] = useState('')
  const [status, setStatus] = useState(initialStatus === 'UPCOMING' || Object.hasOwn(TRACKING_STATUS_LABELS, initialStatus) ? initialStatus : '')
  const [cycle, setCycle] = useState('')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<AdminCompanyListItem | null>(null)
  const [today, setToday] = useState(colombiaToday)
  useEffect(() => { const timer = window.setInterval(() => setToday(colombiaToday()), 60000); return () => window.clearInterval(timer) }, [])
  const plans = [...new Map(companies.flatMap(company => company.integrations.flatMap(item => item.plan ? [[item.plan.id, item.plan] as const] : []))).values()]
  const periods = [...new Set(companies.map(trackingBillingMonths).filter((months): months is number => months !== null))].sort((a, b) => a - b)
  const filtered = companies.filter(company => {
    const text = `${company.name} ${company.nit} ${company.responsible?.email ?? ''} ${company.commercial ?? ''}`.toLocaleLowerCase()
    return text.includes(search.trim().toLocaleLowerCase()) && (!lifecycle || company.clientStatus === lifecycle) && (!plan || company.integrations.some(item => item.plan?.id === plan)) && (!cycle || trackingBillingMonths(company) === Number(cycle)) && (!status || (status === 'UPCOMING' ? ['DUE_SOON', 'DUE_TODAY'].includes(companyTrackingStatus(company, today)) : companyTrackingStatus(company, today) === status))
  }).sort((a, b) => (trackingDueDate(a) ?? '9999').localeCompare(trackingDueDate(b) ?? '9999') || a.name.localeCompare(b.name))
  const pages = Math.max(1, Math.ceil(filtered.length / 10))
  const currentPage = Math.min(page, pages)
  const active = companies.filter(company => (!company.clientStatus || company.clientStatus === 'ACTIVE') && company.integrations.some(item => item.active && (!item.subscriptionStatus || item.subscriptionStatus === 'ACTIVE'))).length
  const count = (statuses: TrackingStatus[]) => companies.filter(company => statuses.includes(companyTrackingStatus(company, today))).length
  const exportCsv = () => {
    const rows = [['Cliente', 'NIT', 'Correo', 'Comercial', 'Integraciones', 'Planes', 'Documentos disponibles', 'Periodicidad', 'Creación', 'Vencimiento', 'Estado'], ...filtered.map(company => [company.name, company.nit, company.responsible?.email ?? '', company.commercial ?? '', company.integrations.map(item => item.provider).join(', '), company.integrations.map(item => item.plan?.name ?? 'Sin plan').join(', '), company.integrations.filter(item => item.provider !== 'BOLD').map(item => `${item.provider}: ${trackingDocumentBalance(item)}`).join(', ') || '—', trackingPeriodLabel(company), colombiaToday(new Date(company.createdAt)), trackingDueDate(company) ?? '', (company.clientStatus ? CLIENT_STATUS_LABELS[company.clientStatus] : TRACKING_STATUS_LABELS[companyTrackingStatus(company, today)])])]
    const url = URL.createObjectURL(new Blob(['\uFEFF' + rows.map(row => row.map(trackingCsvCell).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `seguimiento-${today}.csv`; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return <section className="tracking" aria-label="Seguimiento de clientes">
    <div className="tracking__heading"><div><h2>Seguimiento de clientes</h2><p>Comerciales, planes y vencimientos en un solo lugar.</p></div><Button variant="primary" onClick={onCreate}>+ Nuevo cliente</Button></div>
    <div className="tracking__stats">
      {[{ label: 'Clientes totales', value: companies.length, detail: `${active} activos · ${companies.length - active} inactivos`, tone: 'blue' }, { label: 'Próximos a vencer', value: count(['DUE_SOON', 'DUE_TODAY']), detail: 'Hoy y en los próximos 7 días', tone: 'teal' }, { label: 'Vencidos', value: count(['OVERDUE']), detail: 'Requieren seguimiento', tone: 'red' }, { label: 'Sin periodicidad', value: count(['UNCONFIGURED']), detail: 'Pendientes de configurar', tone: 'gray' }].map(card => <div key={card.label} className="tracking__stat"><span aria-hidden="true" className={`tracking__stat-icon tracking__stat-icon--${card.tone}`}><SummaryIcon kind={card.tone} /></span><div><span>{card.label}</span><strong>{loading ? '—' : card.value}</strong><small>{card.detail}</small></div></div>)}
    </div>
    <div className="tracking__card">
      <div className="tracking__filters">
        <label className="tracking__search"><span className="tracking__sr-only">Buscar cliente</span><input type="search" placeholder="Buscar cliente, NIT, correo o comercial…" value={search} onChange={event => { setSearch(event.target.value); setPage(1) }} /></label>
        <select aria-label="Filtrar por plan" value={plan} onChange={event => { setPlan(event.target.value); setPage(1) }}><option value="">Todos los planes</option>{plans.map(item => <option key={item.id} value={item.id}>{item.provider} · {item.name}</option>)}</select>
        <select aria-label="Filtrar por periodicidad" value={cycle} onChange={event => { setCycle(event.target.value); setPage(1) }}><option value="">Todas las periodicidades</option>{periods.map(months => <option key={months} value={months}>{trackingPeriodLabel({ billingMonths: months })}</option>)}</select>
        <select aria-label="Filtrar por etapa del cliente" value={lifecycle} onChange={event => { setLifecycle(event.target.value); setPage(1) }}><option value="">Todas las etapas</option>{Object.entries(CLIENT_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <select aria-label="Filtrar por vencimiento" value={status} onChange={event => { setStatus(event.target.value); setPage(1) }}><option value="">Todos los estados</option><option value="UPCOMING">Hoy y próximos 7 días</option>{Object.entries(TRACKING_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <Button variant="outline" onClick={exportCsv} disabled={loading || !filtered.length}>↓ Exportar</Button>
      </div>
      {loading ? <LoadingIndicator message="Cargando clientes…" /> : !filtered.length ? <div className="tracking__empty">{companies.length ? 'No hay clientes que coincidan con los filtros.' : 'Aún no hay empresas registradas.'}</div> : <>
        <div className="tracking__table-wrap"><table className="tracking__table"><colgroup><col className="tracking__col-client" /><col className="tracking__col-commercial" /><col className="tracking__col-plan" /><col className="tracking__col-documents" /><col className="tracking__col-period" /><col className="tracking__col-date" /><col className="tracking__col-date" /><col className="tracking__col-status" /><col className="tracking__col-actions" /></colgroup><thead><tr><th>Cliente</th><th>Comercial</th><th>Integración / plan</th><th className="tracking__documents">Documentos<br />disponibles</th><th>Periodicidad</th><th>Creación</th><th>Vencimiento</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>
          {filtered.slice((currentPage - 1) * 10, currentPage * 10).map(company => { const state = companyTrackingStatus(company, today); return <tr key={company.id}>
            <td data-label="Cliente"><div className="tracking__client"><span className="tracking__avatar" aria-hidden="true">{company.name.trim().slice(0, 2).toUpperCase()}</span><div><Link to={`/admin/clientes/${encodeURIComponent(company.id)}`}><strong>{company.name}</strong></Link><small>NIT {company.nit}</small>{company.responsible?.email && <small>{company.responsible.email}</small>}</div></div></td>
            <td data-label="Comercial">{company.commercial || <span className="tracking__muted">Sin asignar</span>}</td>
            <td data-label="Integración / plan"><div className="tracking__plans">{company.integrations.length ? company.integrations.map(item => <span className="tracking__integration-row" key={item.id}><b>{item.provider === 'JARVIS' ? 'Jarvis' : item.provider === 'SIIGO' ? 'Siigo' : 'Bold'}</b><span title={item.plan?.name ?? 'Sin plan'}>{item.plan?.name ?? 'Sin plan'}{item.subscriptionStatus && item.subscriptionStatus !== 'ACTIVE' && <small>{item.subscriptionStatus === 'SUSPENDED' ? 'Suspendido' : 'Cancelado'}</small>}</span></span>) : 'Sin integración'}</div></td>
            <td data-label="Documentos disponibles" className="tracking__documents"><div className="tracking__balances">{company.integrations.length ? company.integrations.map(item => <span className="tracking__balance-row" key={item.id}>{company.integrations.length > 1 && <small className="tracking__balance-provider">{item.provider}</small>}<strong aria-label={item.provider + ': ' + (item.provider === 'BOLD' ? 'No aplica' : trackingDocumentBalance(item))}>{item.provider === 'BOLD' ? '—' : trackingDocumentBalance(item)}</strong></span>) : <span className="tracking__muted">—</span>}</div></td>
            <td data-label="Periodicidad">{trackingPeriodLabel(company)}</td><td data-label="Creación" className="tracking__date">{dateLabel(colombiaToday(new Date(company.createdAt)))}</td><td data-label="Vencimiento" className="tracking__date">{dateLabel(trackingDueDate(company))}</td>
            <td data-label="Estado"><span className={`tracking__badge tracking__badge--${company.clientStatus && company.clientStatus !== 'ACTIVE' ? 'due_soon' : state.toLowerCase()}`}>{company.clientStatus ? CLIENT_STATUS_LABELS[company.clientStatus] : TRACKING_STATUS_LABELS[state]}</span></td>
            <td data-label="Acciones"><button type="button" className="tracking__edit" aria-label={`Configurar seguimiento de ${company.name}`} onClick={() => setEditing(company)}>Editar</button></td>
          </tr> })}
        </tbody></table></div>
        {shouldShowTablePagination(filtered.length) && <footer className="tracking__pagination"><span>{(currentPage - 1) * 10 + 1}–{Math.min(currentPage * 10, filtered.length)} de {filtered.length} clientes</span><div><Button variant="outline" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Anterior</Button><span>{currentPage} / {pages}</span><Button variant="outline" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>Siguiente</Button></div></footer>}
      </>}
    </div>
    <p className="tracking__muted">Los pagos registrados renuevan un período según los meses configurados y activan el plan del cliente.</p>
    {editing && <TrackingEditor key={editing.id} company={editing} onClose={() => setEditing(null)} onSaved={company => { onUpdated(company); setEditing(null) }} />}
  </section>
}
