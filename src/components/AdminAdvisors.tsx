import { invalidateQueryCache } from '../services/queryCache'
import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import type { AdminAdvisor, AdminCompanyListItem, AdvisorAccessDelivery, AdvisorConversionUser } from '../types/admin'
import { assignAdvisorClient, convertUserToAdvisor, createAdminAdvisor, fetchAdminAdvisors, lookupAdvisorConversionUser, sendAdvisorAccess, updateAdminAdvisor } from '../services/adminAdvisorsService'
import { getApiErrorMessage } from '../services/apiClient'
import { shouldShowTablePagination } from '../utils/tablePagination'
import Button from './Button'
import Banner from './Banner'
import ErrorMessage from './ErrorMessage'
import LoadingIndicator from './LoadingIndicator'
import CommissionReport from './CommissionReport'
import { BusinessMetrics } from './BusinessDashboard'
import './AdminAdvisors.css'

function Pages({ total, page, onChange }: { total: number; page: number; onChange: (page: number) => void }) {
  if (!shouldShowTablePagination(total)) return null
  const pages = Math.ceil(total / 10)
  return <div className="advisors__pagination"><Button variant="outline" disabled={page === 1} onClick={() => onChange(page - 1)}>Anterior</Button><span>{page} / {pages}</span><Button variant="outline" disabled={page === pages} onClick={() => onChange(page + 1)}>Siguiente</Button></div>
}

export function AdvisorsTable({ items, busy, onEdit, onClients, onSend }: { items: AdminAdvisor[]; busy: boolean; onEdit: (advisor: AdminAdvisor) => void; onClients: (advisor: AdminAdvisor) => void; onSend: (advisor: AdminAdvisor) => void }) {
  const [page, setPage] = useState(1)
  const current = Math.min(page, Math.max(1, Math.ceil(items.length / 10)))
  return <><div className="advisors__table-wrap"><table className="advisors__table"><thead><tr><th>Asesor</th><th>Correo</th><th>Clientes</th><th>Comisión</th><th>Registro</th><th>Acciones</th></tr></thead><tbody>
    {items.slice((current - 1) * 10, current * 10).map(advisor => <tr key={advisor.id}>
      <td data-label="Asesor"><Link to={`/admin/asesores/${encodeURIComponent(advisor.id)}`}>{advisor.name}</Link></td><td data-label="Correo">{advisor.email}</td><td data-label="Clientes"><button className="advisors__link" type="button" disabled={busy} onClick={() => onClients(advisor)}>{advisor.clients.length} {advisor.clients.length === 1 ? 'cliente' : 'clientes'}</button></td>
      <td data-label="Comisión">Según producto</td><td data-label="Registro"><span className={`advisors__status${advisor.registered ? ' advisors__status--active' : ''}`}>{advisor.registered ? 'Registrado' : 'Pendiente'}</span>{advisor.lastDeliveryStatus === 'FAILED' && <small>Correo pendiente</small>}</td>
      <td data-label="Acciones"><div className="advisors__actions"><Link className="btn btn--primary btn--sm" to={`/admin/asesores/${encodeURIComponent(advisor.id)}`}>Ver panel</Link><Button size="sm" variant="outline" disabled={busy} onClick={() => onEdit(advisor)}>Editar</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => onSend(advisor)}>{advisor.registered ? 'Enviar acceso' : 'Reenviar correo'}</Button></div></td>
    </tr>)}
    {!items.length && <tr><td colSpan={6}>No hay asesores para mostrar.</td></tr>}
  </tbody></table></div><Pages total={items.length} page={current} onChange={setPage} /></>
}

function ClientList({ advisor, companies, busy, onAssign, onClose }: { advisor: AdminAdvisor; companies: AdminCompanyListItem[]; busy: boolean; onAssign: (companyId: string, remove?: boolean) => Promise<void>; onClose: () => void }) {
  const [companyId, setCompanyId] = useState('')
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const rows = advisor.clients.filter(item => `${item.name} ${item.nit}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
  const current = Math.min(page, Math.max(1, Math.ceil(rows.length / 10)))
  const available = companies.filter(company => !company.advisorId)
  return <section className="admin-card advisors__clients"><div className="advisors__heading"><h2>Clientes de {advisor.name}</h2><Button variant="outline" disabled={busy} onClick={onClose}>Cerrar</Button></div>
    <form className="advisors__assign" onSubmit={event => { event.preventDefault(); if (companyId) void onAssign(companyId).then(() => setCompanyId('')) }}>
      <label className="admin-form__field">Asignar cliente<select value={companyId} onChange={event => setCompanyId(event.target.value)} disabled={busy} required><option value="">Selecciona un cliente</option>{available.map(item => <option key={item.id} value={item.id}>{item.name} · {item.nit}</option>)}</select></label><Button type="submit" disabled={busy || !companyId}>Asignar</Button>
    </form>
    <label className="admin-form__field advisors__search">Buscar cliente<input type="search" value={search} onChange={event => { setSearch(event.target.value); setPage(1) }} placeholder="Nombre o NIT" /></label>
    <div className="advisors__table-wrap"><table className="advisors__table"><thead><tr><th>Cliente</th><th>NIT</th><th>Acciones</th></tr></thead><tbody>{rows.slice((current - 1) * 10, current * 10).map(client => <tr key={client.id}><td data-label="Cliente"><Link to={`/admin/clientes/${encodeURIComponent(client.id)}`}>{client.name}</Link></td><td data-label="NIT">{client.nit}</td><td data-label="Acciones"><Button size="sm" variant="outline" disabled={busy} onClick={() => void onAssign(client.id, true)}>Desvincular</Button></td></tr>)}{!rows.length && <tr><td colSpan={3}>No hay clientes para mostrar.</td></tr>}</tbody></table></div>
    <Pages total={rows.length} page={current} onChange={setPage} />
  </section>
}

export default function AdminAdvisors({ companies, onCompanyAssigned }: { companies: AdminCompanyListItem[]; onCompanyAssigned: (companyId: string, advisorId: string | null, name: string | null) => void }) {
  const [items, setItems] = useState<AdminAdvisor[]>([])
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState<AdvisorAccessDelivery | null>(null)
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const [registration, setRegistration] = useState('')
  const [editing, setEditing] = useState<AdminAdvisor | 'new' | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showCommissions, setShowCommissions] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [converting, setConverting] = useState(false)
  const [conversionEmail, setConversionEmail] = useState('')
  const [conversionUser, setConversionUser] = useState<AdvisorConversionUser | null>(null)
  useEffect(() => {
    let cancelled = false
    void fetchAdminAdvisors().then(data => { if (!cancelled) setItems(data.items) }).catch(failure => { if (!cancelled) setError(getApiErrorMessage(failure, 'No se pudo cargar la lista de asesores.')) }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [revision])
  const update = (advisor: AdminAdvisor) => setItems(current => current.some(item => item.id === advisor.id) ? current.map(item => item.id === advisor.id ? advisor : item) : [advisor, ...current])
  const openEditor = (advisor: AdminAdvisor | 'new') => {
    setConverting(false); setEditing(advisor); setError(''); setNotice(null)
    setName(advisor === 'new' ? '' : advisor.name); setEmail(advisor === 'new' ? '' : advisor.email)
  }
  const findConversionUser = async (event: FormEvent) => {
    event.preventDefault(); if (busy) return
    setBusy(true); setError(''); setNotice(null); setConversionUser(null)
    try { const result = await lookupAdvisorConversionUser(conversionEmail.trim()); setConversionUser(result.user) }
    catch (failure) { setError(getApiErrorMessage(failure, 'No se pudo buscar el usuario.')) }
    finally { setBusy(false) }
  }
  const convert = async () => {
    if (busy || !conversionUser?.canConvert) return
    setBusy(true); setError(''); setNotice(null)
    try {
      const result = await convertUserToAdvisor(conversionUser.id)
      update(result.advisor); setRegistration(''); setSearch(''); setConverting(false); setConversionUser(null); setConversionEmail('')
      setNotice({ status: 'SENT', message: result.changed ? 'Comercial habilitado. El usuario debe volver a iniciar sesión con su cuenta actual.' : 'El usuario ya tiene acceso comercial.' })
    } catch (failure) { setError(getApiErrorMessage(failure, 'No se pudo convertir el usuario a comercial.')) }
    finally { setBusy(false) }
  }
  const save = async (event: FormEvent) => {
    event.preventDefault(); if (!editing || busy) return
    setBusy(true); setError(''); setNotice(null)
    const input = { name: name.trim(), commissionType: editing === 'new' ? 'FIXED' as const : editing.commissionType, commissionValue: editing === 'new' ? null : editing.commissionValue }
    try {
      if (editing === 'new') { const result = await createAdminAdvisor({ ...input, email: email.trim() }); update(result.advisor); setNotice(result.delivery) }
      else { const result = await updateAdminAdvisor(editing.id, input); update(result.advisor); for (const client of result.advisor.clients) onCompanyAssigned(client.id, result.advisor.id, result.advisor.name); setNotice({ status: 'SENT', message: 'Asesor actualizado.' }) }
      setEditing(null)
    } catch (failure) { setError(getApiErrorMessage(failure, 'No se pudo guardar el asesor.')) }
    finally { setBusy(false) }
  }
  const send = async (advisor: AdminAdvisor) => {
    if (busy) return
    setBusy(true); setError(''); setNotice(null)
    try { const delivery = await sendAdvisorAccess(advisor.id); setNotice(delivery); update({ ...advisor, lastDeliveryStatus: delivery.status }) }
    catch (failure) { setError(getApiErrorMessage(failure, 'No se pudo enviar el correo.')) }
    finally { setBusy(false) }
  }
  const selected = items.find(item => item.id === selectedId)
  const assign = async (companyId: string, remove = false) => {
    if (!selected || busy) return
    setBusy(true); setError(''); setNotice(null)
    try { const result = await assignAdvisorClient(selected.id, companyId, remove); update(result.advisor); onCompanyAssigned(companyId, remove ? null : selected.id, remove ? null : selected.name); setNotice({ status: 'SENT', message: remove ? 'Cliente desvinculado.' : 'Cliente asignado.' }) }
    catch (failure) { setError(getApiErrorMessage(failure, 'No se pudo cambiar la asignación del cliente.')) }
    finally { setBusy(false) }
  }
  const visible = items.filter(item => `${item.name} ${item.email}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()) && (!registration || (registration === 'registered' ? item.registered : registration === 'failed' ? item.lastDeliveryStatus === 'FAILED' : !item.registered)))
  return <section className="advisors" aria-label="Administrar asesores">
    {!loading && <BusinessMetrics items={[
      { label: 'Equipo comercial', value: items.length, detail: 'Todos los asesores', onClick: () => setRegistration('') },
      { label: 'Registrados', value: items.filter(item => item.registered).length, detail: 'Con acceso creado', onClick: () => setRegistration('registered') },
      { label: 'Por registrarse', value: items.filter(item => !item.registered).length, detail: 'Invitaciones pendientes', tone: 'warning', onClick: () => setRegistration('pending') },
      { label: 'Correo por revisar', value: items.filter(item => item.lastDeliveryStatus === 'FAILED').length, detail: 'Reenviar acceso', tone: 'danger', onClick: () => setRegistration('failed') },
    ]} />}
    <div className="advisors__heading"><h2>Equipo comercial</h2><div className="advisors__actions"><Button variant="outline" onClick={() => setShowCommissions(value => !value)}>{showCommissions ? 'Ocultar comisiones' : 'Comisiones mensuales'}</Button><Button variant="outline" disabled={busy || loading} onClick={() => { setConverting(value => !value); setEditing(null); setConversionUser(null); setConversionEmail(''); setError(''); setNotice(null) }}>Convertir a comercial</Button><Button disabled={busy || loading} onClick={() => openEditor('new')}>+ Crear asesor</Button></div></div>
    {showCommissions && <CommissionReport admin />}
    {error && <ErrorMessage inline message={error} />}{notice && <Banner variant={notice.status === 'SENT' ? 'success' : 'warning'} message={notice.message} />}
    {converting && <section className="admin-card"><h2>Convertir a comercial</h2>
      <form className="advisors__assign" onSubmit={event => void findConversionUser(event)}>
        <label className="admin-form__field">Correo del usuario<input type="email" value={conversionEmail} onChange={event => { setConversionEmail(event.target.value); setConversionUser(null); setError('') }} required maxLength={254} disabled={busy} autoComplete="off" /></label>
        <Button type="submit" variant="outline" disabled={busy || !conversionEmail.trim()}>{busy && !conversionUser ? 'Buscando…' : 'Buscar usuario'}</Button>
      </form>
      {conversionUser && <div className="advisors__conversion-user" role="status"><strong>{conversionUser.name}</strong><span>{conversionUser.email}</span>
        {conversionUser.reason ? <span>{conversionUser.reason}</span> : <span>Conservará su contraseña y su historial comercial.</span>}
        {!conversionUser.canConvert && conversionUser.active && conversionUser.role === 'advisor' && conversionUser.advisorId && <Link to={`/admin/asesores/${encodeURIComponent(conversionUser.advisorId)}`}>Ver panel comercial</Link>}
      </div>}
      <div className="advisors__actions"><Button disabled={busy || !conversionUser?.canConvert} onClick={() => void convert()}>{busy && conversionUser ? 'Convirtiendo…' : 'Convertir a comercial'}</Button><Button variant="outline" disabled={busy} onClick={() => setConverting(false)}>Cancelar</Button></div>
    </section>}
    {editing && <section className="admin-card"><h2>{editing === 'new' ? 'Crear asesor' : 'Editar asesor'}</h2><form className="admin-form" onSubmit={event => void save(event)}><div className="admin-form__grid">
      <label className="admin-form__field">Nombre<input value={name} onChange={event => setName(event.target.value)} required maxLength={120} disabled={busy} /></label>
      <label className="admin-form__field">Correo<input type="email" value={email} onChange={event => setEmail(event.target.value)} required maxLength={254} disabled={busy || editing !== 'new'} /></label>
    </div><div className="advisors__actions"><Button type="submit" disabled={busy}>{busy ? 'Guardando…' : editing === 'new' ? 'Crear y enviar acceso' : 'Guardar'}</Button><Button variant="outline" disabled={busy} onClick={() => setEditing(null)}>Cancelar</Button></div></form></section>}
    {selected && <ClientList key={selected.id} advisor={selected} companies={companies} busy={busy} onAssign={assign} onClose={() => setSelectedId(null)} />}
    <section className="admin-card"><div className="business-filters"><label className="admin-form__field advisors__search">Buscar asesor<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Nombre o correo" /></label><label className="admin-form__field">Registro<select value={registration} onChange={event => setRegistration(event.target.value)}><option value="">Todos</option><option value="registered">Registrados</option><option value="pending">Pendientes</option><option value="failed">Correo por revisar</option></select></label><Button variant="outline" disabled={loading || busy} onClick={() => { invalidateQueryCache('admin:advisors'); setLoading(true); setError(''); setRevision(value => value + 1) }}>Actualizar</Button></div>
      {loading ? <LoadingIndicator message="Cargando asesores…" /> : <AdvisorsTable items={visible} busy={busy} onEdit={openEditor} onClients={advisor => setSelectedId(advisor.id)} onSend={advisor => void send(advisor)} />}
    </section>
  </section>
}
