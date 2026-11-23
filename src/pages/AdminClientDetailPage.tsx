import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import AdminSidebar from '../components/AdminSidebar'
import AdminDocumentPackages from '../components/AdminDocumentPackages'
import PageHeader from '../components/PageHeader'
import Button from '../components/Button'
import LoadingIndicator from '../components/LoadingIndicator'
import ErrorMessage from '../components/ErrorMessage'
import SuccessMessage from '../components/SuccessMessage'
import CompanyJarvisCommercialEditor from '../components/CompanyJarvisCommercialEditor'
import { TrackingEditor } from '../components/AdminTracking'
import CommissionReport from '../components/CommissionReport'
import ClientPaymentCard from '../components/ClientPaymentCard'
import { useAuth } from '../context/AuthContext'
import { addAdminCompanyComment, fetchAdminCompanyDetails, fetchAdminJarvisTopUps, fetchAdminPlans, updateAdminCompanyProfile } from '../services/adminService'
import { getApiErrorMessage } from '../services/apiClient'
import type { AdminCommercialActivity, AdminCompanyDetails, AdminCompanyListItem, AdminJarvisTopUp, AdminPlan } from '../types/admin'
import { formatCop } from '../utils/adminPlan'
import { colombiaToday, trackingDocumentBalance, trackingDueDate } from '../utils/companyTracking'
import { shouldShowTablePagination } from '../utils/tablePagination'
import { CLIENT_STATUS_LABELS } from '../utils/clientLifecycle'
import './AdminPage.css'
import './AdminClientDetailPage.css'

const dateLabel = (value?: string | null) => value ? new Date(value).toLocaleDateString('es-CO', { timeZone: 'America/Bogota', day: '2-digit', month: 'short', year: 'numeric' }) : 'Sin registrar'
const yearOf = (value: string) => Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Bogota', year: 'numeric' }).format(new Date(value)))
const operationLabels = { APPLIED: 'Aplicada', PROCESSING: 'Procesando', UNCERTAIN: 'Por confirmar', FAILED: 'No aplicada' }

export function ClientSummary({ company, paymentCard, onRecharge, onPlan, onRenew }: { company: AdminCompanyListItem; paymentCard?: ReactNode; onRecharge?: () => void; onPlan?: () => void; onRenew?: () => void }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 60000); return () => window.clearInterval(timer) }, [])
  const jarvis = company.integrations.find(item => item.provider === 'JARVIS')
  const terms = jarvis?.jarvisCertificateTerm
  const dueDate = trackingDueDate(company)
  const expired = terms ? now >= Date.parse(terms.endsAt) : Boolean(dueDate && dueDate <= colombiaToday(new Date(now)))
  const active = company.integrations.some(item => item.active && item.subscriptionStatus === 'ACTIVE')
  return <div className="client-detail__overview">
    <section className="admin-card client-detail__general"><h2>Información general del cliente</h2>
      <dl className="client-detail__facts">{[['NIT', company.nit], ['Tipo de persona', company.personType === 'LEGAL_ENTITY' ? 'Jurídica' : company.personType === 'NATURAL_PERSON' ? 'Natural' : null], ['Ciudad', company.cityName], ['Correo de bienvenida', company.registrationEmail ?? company.email], ['Descripción de la empresa', company.description]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || 'Sin registrar'}</dd></div>)}</dl>
      <div className="client-detail__group"><h3>Comercial asignado</h3><strong>{company.commercial || 'Sin asignar'}</strong><small>Creada el {dateLabel(company.createdAt)}</small></div>
      <div className="client-detail__group"><h3>Información de contacto</h3><dl className="client-detail__facts"><div><dt>Nombre</dt><dd>{company.responsible?.name || 'Sin registrar'}</dd></div><div><dt>Teléfono</dt><dd>{company.responsible?.phone || 'Sin registrar'}</dd></div></dl></div>
    </section>
    <section className="admin-card client-detail__plans"><div className="client-detail__section-heading"><h2>Planes y suscripción</h2><span className={`client-detail__status${company.clientStatus && company.clientStatus !== 'ACTIVE' ? ' client-detail__status--pending' : expired ? ' client-detail__status--expired' : !active ? ' client-detail__status--inactive' : ''}`}>{expired && company.clientStatus === 'ACTIVE' ? 'Vencido' : company.clientStatus ? CLIENT_STATUS_LABELS[company.clientStatus] : expired ? 'Vencido' : active ? 'Activo' : 'Inactivo'}</span></div>
      {company.integrations.filter(item => item.plan).map(item => <article className="client-detail__plan" key={item.id}>
        <h3>{item.plan!.name}</h3><strong>{item.plan!.commercialTerms ? `${formatCop(item.plan!.commercialTerms.priceCop)} / ${item.provider === 'JARVIS' || item.plan!.commercialTerms.billingMonths === 12 ? 'año' : item.plan!.commercialTerms.billingMonths === 1 ? 'mes' : `${item.plan!.commercialTerms.billingMonths} meses`}` : item.plan!.salePriceCop != null ? `${formatCop(item.plan!.salePriceCop)}${item.provider === 'SIIGO' ? ' / mes' : ''}` : 'Valor sin registrar'}</strong>
        {item.provider === 'JARVIS' && !terms ? <p>Certificado sin consultar</p> : <dl className="client-detail__facts"><div><dt>Inicio</dt><dd>{dateLabel(item.provider === 'JARVIS' ? terms?.startsAt : company.trackingPeriodStart ? company.trackingPeriodStart + 'T12:00:00-05:00' : company.createdAt)}</dd></div><div><dt>Vence</dt><dd>{dateLabel(item.provider === 'JARVIS' ? terms?.endsAt : company.subscriptionDueDate ? company.subscriptionDueDate + 'T00:00:00-05:00' : null)}</dd></div></dl>}
      </article>)}
      {!company.integrations.some(item => item.plan) && <p>Sin plan asignado.</p>}
      <div className="client-detail__group"><h3>Integraciones habilitadas</h3><div className="client-detail__integrations">{company.integrations.map(item => <span key={item.id}>{item.provider} · {item.active ? 'Habilitada' : 'Inactiva'}</span>)}</div></div>
      <div className="client-detail__actions">{jarvis && onPlan && <Button variant="outline" onClick={onPlan}>Asignar plan</Button>}{onRenew && <Button variant="outline" onClick={onRenew}>Renovar plan</Button>}</div>
    </section>
    <div className="client-detail__aside"><section className="admin-card"><div className="client-detail__section-heading"><h2>Recargas y documentos</h2>{jarvis?.plan && onRecharge && <Button variant="ghost" onClick={onRecharge}>Agregar recarga</Button>}</div>
      {company.integrations.filter(item => item.provider !== 'BOLD').map(item => { const quota = item.documentQuota; return <div className="client-detail__quota" key={item.id}><span>{item.provider} · Documentos disponibles</span><strong>{trackingDocumentBalance(item)}</strong>{quota && quota.documentLimit !== null && quota.documentLimit > 0 && <progress aria-label={`Documentos disponibles en ${item.provider}`} value={quota.remaining ?? 0} max={quota.documentLimit} />}<small>Consumidos: {quota?.documentsUsed ?? 'Sin consultar'}</small></div> })}
    </section>{paymentCard}</div>
  </div>
}

function RechargeHistory({ company, onRecharge }: { company: AdminCompanyListItem; onRecharge: () => void }) {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [page, setPage] = useState(1)
  const jarvis = company.integrations.find(item => item.provider === 'JARVIS')
  const rows = company.integrations.flatMap(integration => (integration.topUpOperations ?? []).filter(operation => operation.topUps.length > 0).map(operation => ({ ...operation, provider: integration.provider }))).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const baseDate = jarvis?.jarvisDocumentCycle?.startedAt ?? jarvis?.subscriptionStartedAt ?? company.createdAt
  const years = [...new Set([yearOf(baseDate), ...rows.map(item => yearOf(item.createdAt))])].sort((a, b) => b - a)
  const year = years.includes(selectedYear) ? selectedYear : years[0]
  const filtered = rows.filter(item => yearOf(item.createdAt) === year)
  const showBase = Boolean(jarvis?.plan && yearOf(baseDate) === year)
  const total = filtered.length + Number(showBase)
  const pages = Math.max(1, Math.ceil(total / 10))
  const currentPage = Math.min(page, pages)
  const allRows = [
    ...(showBase ? [{ id: 'base', createdAt: baseDate, label: `Plan: ${jarvis!.plan!.name}`, documents: jarvis!.plan!.documentLimit, value: jarvis!.plan!.commercialTerms?.priceCop ?? null, status: 'Plan asignado', payment: 'Ver pagos registrados' }] : []),
    ...filtered.map(item => ({ id: item.id, createdAt: item.createdAt, label: item.topUps.map(topUp => topUp.name).join(' · '), documents: item.topUps.filter(topUp => topUp.kind === 'DOCUMENTS').reduce((sum, topUp) => sum + topUp.units, 0), value: item.topUps.reduce((sum, topUp) => sum + topUp.priceCop, 0), status: operationLabels[item.status], payment: 'No registrado' })),
  ]
  return <section className="admin-card client-detail__card">
    <div className="client-detail__section-heading"><h2>Recargas del cliente</h2><div><label className="client-detail__year">Año <select value={year} onChange={event => { setSelectedYear(Number(event.target.value)); setPage(1) }}>{years.map(value => <option key={value}>{value}</option>)}</select></label><Button disabled={!jarvis?.plan} onClick={onRecharge}>+ Agregar recarga</Button></div></div>
    <div className="client-detail__table"><table><thead><tr><th>Fecha</th><th>Movimiento</th><th>Documentos</th><th>Valor</th><th>Pago</th><th>Activación</th></tr></thead><tbody>
      {allRows.slice((currentPage - 1) * 10, currentPage * 10).map(item => <tr key={item.id}><td>{dateLabel(item.createdAt)}</td><td>{item.label}</td><td>{item.documents === null ? 'Sin límite' : item.documents}</td><td>{item.value === null ? 'Sin registrar' : formatCop(item.value)}</td><td>{item.payment}</td><td>{item.status}</td></tr>)}
      {!allRows.length && <tr><td colSpan={6}>No hay recargas registradas en este año.</td></tr>}
    </tbody></table></div>
    <div className="client-detail__balance">{company.integrations.filter(item => item.documentQuota).map(item => <span key={item.id}><b>{item.provider}</b> · Asignados: {item.documentQuota!.documentLimit ?? 'Sin límite'} · Consumidos: {item.documentQuota!.documentsUsed} · <strong>Disponibles: {trackingDocumentBalance(item)}</strong></span>)}</div>
    {shouldShowTablePagination(total) && <div className="client-detail__pagination"><Button variant="outline" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Anterior</Button><span>{currentPage} / {pages}</span><Button variant="outline" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>Siguiente</Button></div>}
  </section>
}

export function PaymentHistory({ activity, lastPaidAt }: { activity: AdminCommercialActivity[]; lastPaidAt?: string | null }) {
  const [page, setPage] = useState(1)
  const rows = activity.filter(item => item.kind === 'PAYMENT').slice().reverse()
  const pages = Math.max(1, Math.ceil(rows.length / 10))
  const currentPage = Math.min(page, pages)
  return <>
    <div className="client-detail__table"><table><thead><tr><th>Fecha</th><th>Plan</th><th>Valor</th><th>Estado</th></tr></thead><tbody>
      {rows.slice((currentPage - 1) * 10, currentPage * 10).map(item => <tr key={item.id}><td>{dateLabel(item.createdAt)}</td><td>{item.planName ?? item.provider ?? 'Renovación'}</td><td>{item.amountCop == null ? 'No informado' : formatCop(item.amountCop)}</td><td>Pago registrado</td></tr>)}
      {!rows.length && <tr><td colSpan={4}>No hay pagos registrados.{lastPaidAt ? ` Último pago informado: ${dateLabel(lastPaidAt)}.` : ''}</td></tr>}
    </tbody></table></div>
    {shouldShowTablePagination(rows.length) && <div className="client-detail__pagination"><Button variant="outline" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Anterior</Button><span>{currentPage} / {pages}</span><Button variant="outline" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>Siguiente</Button></div>}
  </>
}

function ProfileEditor({ company, onSaved, onCancel }: { company: AdminCompanyListItem; onSaved: (details: AdminCompanyDetails) => void; onCancel: () => void }) {
  const [name, setName] = useState(company.name)
  const [contact, setContact] = useState(company.responsible?.name ?? '')
  const [phone, setPhone] = useState(company.responsible?.phone ?? '')
  const [commercial, setCommercial] = useState(company.commercial ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (busy) return
    setBusy(true); setError('')
    try { onSaved(await updateAdminCompanyProfile(company.id, { name, responsible: contact.trim() || phone.trim() ? { name: contact, phone, email: company.responsible?.email ?? '' } : null, commercial: commercial.trim() || null })) }
    catch (failure) { setError(getApiErrorMessage(failure, 'No se pudo guardar el cliente.')) }
    finally { setBusy(false) }
  }
  return <section className="admin-card"><h2>Editar cliente</h2><form className="admin-form" onSubmit={event => void submit(event)}><div className="admin-form__grid">
    <label className="admin-form__field">Razón social<input value={name} onChange={event => setName(event.target.value)} required maxLength={200} disabled={busy} /></label>
    <label className="admin-form__field">Contacto<input value={contact} onChange={event => setContact(event.target.value)} maxLength={200} disabled={busy} /></label>
    <label className="admin-form__field">Teléfono<input value={phone} onChange={event => setPhone(event.target.value)} maxLength={50} disabled={busy} /></label>
    <label className="admin-form__field">{company.advisorId ? 'Asesor asignado' : 'Comercial'}<input value={commercial} onChange={event => setCommercial(event.target.value)} maxLength={120} disabled={busy || Boolean(company.advisorId)} /></label>
  </div>{error && <ErrorMessage inline message={error} />}<div className="client-detail__actions"><Button type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</Button><Button variant="outline" disabled={busy} onClick={onCancel}>Cancelar</Button></div></form></section>
}

function ClientDetailContent({ companyId }: { companyId?: string }) {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const [details, setDetails] = useState<AdminCompanyDetails | null>(null)
  const [plans, setPlans] = useState<AdminPlan[]>([])
  const [catalog, setCatalog] = useState<AdminJarvisTopUp[]>([])
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [tab, setTab] = useState<'topUps' | 'payments' | 'comments' | 'nextpyme' | null>(null)
  const [editor, setEditor] = useState<'plan' | 'topUps' | 'profile' | 'renew' | null>(null)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  useEffect(() => {
    if (!companyId) return
    let cancelled = false
    fetchAdminCompanyDetails(companyId).then(data => {
      if (!cancelled) setDetails(data)
    }).catch(failure => { if (!cancelled) setError(getApiErrorMessage(failure, 'No se pudo cargar el cliente.')) })
    const refresh = () => {
      void fetchAdminCompanyDetails(companyId).then(data => { if (!cancelled) setDetails(data) })
        .catch(failure => { if (!cancelled) setError(getApiErrorMessage(failure, 'No se pudo actualizar el cliente.')) })
    }
    window.addEventListener('focus', refresh)
    return () => { cancelled = true; window.removeEventListener('focus', refresh) }
  }, [companyId])
  useEffect(() => {
    if (editor !== 'plan' && editor !== 'topUps') return
    let cancelled = false
    setCatalogLoading(true)
    void Promise.all([fetchAdminPlans(), fetchAdminJarvisTopUps()]).then(([availablePlans, topUps]) => {
      if (!cancelled) { setPlans(availablePlans.items); setCatalog(topUps.items) }
    }).catch(failure => { if (!cancelled) { setError(getApiErrorMessage(failure, 'No se pudo cargar el catálogo.')); setEditor(null) } })
      .finally(() => { if (!cancelled) setCatalogLoading(false) })
    return () => { cancelled = true }
  }, [editor, companyId])
  const saved = (company: AdminCompanyListItem, message = 'Cambios guardados.') => {
    setDetails(current => current ? { ...current, company } : current); setEditor(null); setSuccess(message)
    void fetchAdminCompanyDetails(company.id).then(setDetails).catch(failure => setError(getApiErrorMessage(failure, 'Actualiza la página para consultar el detalle guardado.')))
  }
  const saveComment = async (event: FormEvent) => {
    event.preventDefault(); if (!details || busy) return
    setBusy(true); setError('')
    try { setDetails(await addAdminCompanyComment(details.company.id, comment)); setComment(''); setSuccess('Comentario guardado.') }
    catch (failure) { setError(getApiErrorMessage(failure, 'No se pudo guardar el comentario.')) }
    finally { setBusy(false) }
  }
  const company = details?.company
  const jarvis = company?.integrations.find(item => item.provider === 'JARVIS')
  return <div className="admin-shell"><AdminSidebar active="tracking" onChange={section => navigate(`/admin?tab=${section}`)} onLogout={() => { logout(); navigate('/login') }} /><main className="admin-page client-detail">
    <nav className="client-detail__breadcrumb" aria-label="Ubicación"><Link to="/admin?tab=tracking">← Volver a clientes</Link></nav>
    {error && <ErrorMessage message={error} />}{success && <SuccessMessage message={success} />}
    {!company ? !error && <LoadingIndicator message="Cargando cliente…" /> : <>
      <PageHeader title={company.name} description={`NIT ${company.nit}${company.responsible?.name ? ` · Contacto: ${company.responsible.name}` : ''}`} actions={<><Button variant="outline" onClick={() => setEditor('profile')}>Editar cliente</Button><Button onClick={() => { setTab('payments'); setEditor(null) }}>Registrar pago / recarga</Button></>} />
      <ClientSummary company={company} onRecharge={() => setEditor('topUps')} onPlan={() => setEditor('plan')} onRenew={() => setEditor('renew')}
        paymentCard={<ClientPaymentCard company={company} activity={details.activity} onPaid={message => saved(company, message)} />} />
      {editor === 'profile' && <ProfileEditor key={company.id} company={company} onCancel={() => setEditor(null)} onSaved={data => { setDetails(data); setEditor(null); setSuccess('Cliente actualizado.') }} />}
      {editor === 'renew' && <TrackingEditor inline company={company} onClose={() => setEditor(null)} onSaved={saved} />}
      {(editor === 'plan' || editor === 'topUps') && jarvis && <section className="admin-card"><div className="client-detail__section-heading"><h2>{editor === 'plan' ? 'Asignar plan' : 'Agregar recarga'}</h2><Button variant="outline" onClick={() => setEditor(null)}>Cerrar</Button></div>{catalogLoading ? <LoadingIndicator message="Cargando planes y recargas…" /> : <CompanyJarvisCommercialEditor key={`${editor}:${jarvis.jarvisDocumentCycle?.id ?? jarvis.id}`} initialMode={editor} company={company} integration={jarvis} plans={plans.filter(item => item.provider === 'JARVIS')} catalog={catalog} onSaved={saved} />}</section>}
      <div className="client-detail__tabs" role="tablist" aria-label="Detalle del cliente">{([{ id: 'topUps', label: 'Ver recargas' }, { id: 'payments', label: 'Pagos y recargas' }, { id: 'comments', label: 'Comentarios' }, { id: 'nextpyme', label: 'NextPyme' }] as const).map(item => <button id={`client-tab-${item.id}`} aria-controls={`client-panel-${item.id}`} role="tab" aria-selected={tab === item.id} key={item.id} onClick={() => setTab(current => current === item.id ? null : item.id)}>{item.label}</button>)}</div>
      {tab && <div id={`client-panel-${tab}`} role="tabpanel" aria-labelledby={`client-tab-${tab}`}>
        {tab === 'topUps' && <RechargeHistory company={company} onRecharge={() => setEditor('topUps')} />}
        {tab === 'payments' && <><div className="client-detail__actions">{jarvis?.plan && <Button onClick={() => setEditor('topUps')}>Agregar recarga</Button>}</div>{company.advisorId && <CommissionReport admin pendingOnly companyId={company.id} onPaid={() => saved(company, 'Pago registrado.')} />}<section className="admin-card"><div className="client-detail__section-heading"><h2>Pagos registrados</h2><Button onClick={() => setEditor('renew')}>Renovar plan</Button></div><PaymentHistory activity={details.activity} lastPaidAt={company.trackingLastPaidAt} /></section></>}
        {tab === 'comments' && <section className="admin-card"><h2>Comentarios</h2><form className="admin-form" onSubmit={event => void saveComment(event)}><label className="admin-form__field">Nuevo comentario<textarea value={comment} onChange={event => setComment(event.target.value)} required maxLength={2000} rows={3} disabled={busy} /></label><Button type="submit" disabled={busy || !comment.trim()}>{busy ? 'Guardando…' : 'Guardar comentario'}</Button></form><div className="client-detail__comments">{details.activity.filter(item => item.kind === 'COMMENT').slice().reverse().map(item => <article key={item.id}><small>{dateLabel(item.createdAt)}</small><p>{item.text}</p></article>)}{!details.activity.some(item => item.kind === 'COMMENT') && <p>Sin comentarios.</p>}</div></section>}
        {tab === 'nextpyme' && <AdminDocumentPackages key={company.id} company={company} />}
      </div>}

    </>}
  </main></div>
}

export default function AdminClientDetailPage() {
  const { companyId } = useParams()
  return <ClientDetailContent key={companyId} companyId={companyId} />
}
