import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { isAdvisorRole } from '../constants/userRole'
import { createAdvisorCompany, fetchAdvisorCatalog, fetchAdvisorDashboard, lookupAdvisorCompanyName } from '../services/advisorService'
import { getApiErrorMessage } from '../services/apiClient'
import type { AdvisorCatalog, AdvisorClient, AdvisorDashboard } from '../types/advisor'
import { shouldShowTablePagination } from '../utils/tablePagination'
import LoadingIndicator from '../components/LoadingIndicator'
import ErrorMessage from '../components/ErrorMessage'
import Banner from '../components/Banner'
import Button from '../components/Button'
import PageHeader from '../components/PageHeader'
import CreateCompanyForm from '../components/CreateCompanyForm'
import AdvisorCommissionPreview from '../components/AdvisorCommissionPreview'
import CommissionReport from '../components/CommissionReport'
import { BusinessMetrics } from '../components/BusinessDashboard'
import { formatCop } from '../utils/adminPlan'
import { colombiaToday } from '../utils/companyTracking'
import { HomeIcon, AdminIcon, PackageIcon } from '../components/icons/SidebarIcons'
import './AdminPage.css'
import './AdvisorAccountPage.css'
import '../components/AdminSidebar.css'

export function AdvisorClients({ clients, onCreate }: { clients: AdvisorClient[]; onCreate?: () => void }) {
  const [search, setSearch] = useState(''), [page, setPage] = useState(1)
  const [provider, setProvider] = useState(''), [sort, setSort] = useState('recent')
  const rows = clients.filter(item => `${item.name} ${item.nit} ${item.plans.map(plan => plan.name).join(' ')}`.toLocaleLowerCase('es').includes(search.trim().toLocaleLowerCase('es')) && (!provider || item.plans.some(plan => plan.provider === provider))).sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name, 'es') : b.createdAt.localeCompare(a.createdAt))
  const pages = Math.max(1, Math.ceil(rows.length / 10)), current = Math.min(page, pages)
  return <section className="admin-card advisor-clients"><div className="advisor-panel__heading"><h2>Mis clientes ({rows.length})</h2>{onCreate && <Button onClick={onCreate}>+ Crear empresa</Button>}</div>
    <div className="business-filters"><label className="admin-form__field">Buscar cliente<input type="search" value={search} onChange={event => { setSearch(event.target.value); setPage(1) }} placeholder="Nombre, NIT o plan" /></label>
      <label className="admin-form__field">Integración<select value={provider} onChange={event => { setProvider(event.target.value); setPage(1) }}><option value="">Todas</option><option value="JARVIS">Jarvis</option><option value="SIIGO">Siigo</option></select></label>
      <label className="admin-form__field">Ordenar por<select value={sort} onChange={event => { setSort(event.target.value); setPage(1) }}><option value="recent">Más recientes</option><option value="name">Nombre</option></select></label>
    </div>
    <table><thead><tr><th>Empresa</th><th>NIT</th><th>Planes</th><th>Creación</th></tr></thead><tbody>{rows.slice((current - 1) * 10, current * 10).map(item => <tr key={item.id}><td data-label="Empresa"><strong>{item.name}</strong></td><td data-label="NIT">{item.nit}</td><td data-label="Planes">{item.plans.map(plan => <span className="advisor-clients__plan" key={`${plan.provider}:${plan.name}`}>{plan.provider}: {plan.name}</span>)}{!item.plans.length && 'Sin plan'}</td><td data-label="Creación">{new Date(item.createdAt).toLocaleDateString('es-CO', { timeZone: 'America/Bogota' })}</td></tr>)}{!rows.length && <tr><td colSpan={4} className="business-empty">{clients.length ? 'No hay clientes con estos filtros.' : 'Tus empresas aparecerán aquí al crearlas.'}</td></tr>}</tbody></table>
    {shouldShowTablePagination(rows.length) && <div className="advisor-panel__actions"><Button variant="outline" disabled={current === 1} onClick={() => setPage(current - 1)}>Anterior</Button><span>{current} / {pages}</span><Button variant="outline" disabled={current === pages} onClick={() => setPage(current + 1)}>Siguiente</Button></div>}
  </section>
}

export function AdvisorOverview({ data, onClients, onCreate, onCommissions }: { data: AdvisorDashboard; onClients: () => void; onCreate: () => void; onCommissions: () => void }) {
  const report = data.commissions
  const pending = report.pending.reduce((sum, sale) => sum + sale.priceCop, 0)
  const month = new Date(`${report.month}-01T12:00:00-05:00`).toLocaleDateString('es-CO', { month: 'long', year: 'numeric', timeZone: 'America/Bogota' })
  return <>
    <BusinessMetrics items={[
      { label: 'Mis clientes', value: data.clients.length, detail: 'Empresas de tu cartera', onClick: onClients },
      { label: 'Ventas pagadas', value: formatCop(report.totalSalesCop), detail: month, onClick: onCommissions },
      { label: 'Comisión del mes', value: formatCop(report.totalCommissionCop), detail: 'Sobre pagos registrados', onClick: onCommissions },
      { label: 'Ventas por cobrar', value: formatCop(pending), detail: `${report.pending.length} ventas pendientes`, tone: 'warning', onClick: onCommissions },
    ]} />
    <section className="business-action-bar"><div><h2>Tu próxima venta empieza aquí</h2><p>Crea una empresa y selecciona su plan.</p></div><Button onClick={onCreate}>+ Crear empresa</Button></section>
    <div className="business-dashboard__columns">
      <section className="admin-card business-list"><div className="business-section-heading"><h2>Pendientes de pago</h2><Button variant="ghost" onClick={onCommissions}>Ver ventas</Button></div>
        {report.pending.slice(0, 5).map(sale => <div className="business-list__row" key={sale.id}><span><strong>{sale.companyName}</strong><small>{sale.productName}</small></span><span><strong>{formatCop(sale.priceCop)}</strong><small className="business-badge business-badge--warning">Pendiente</small></span></div>)}
        {!report.pending.length && <p className="business-empty">No tienes ventas pendientes de pago.</p>}
      </section>
      <section className="admin-card business-list"><div className="business-section-heading"><h2>Clientes recientes</h2><Button variant="ghost" onClick={onClients}>Ver clientes</Button></div>
        {[...data.clients].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5).map(client => <div className="business-list__row" key={client.id}><span><strong>{client.name}</strong><small>NIT {client.nit}</small></span><span className="business-badge">{client.plans.map(plan => plan.provider).join(' / ') || 'Sin plan'}</span></div>)}
        {!data.clients.length && <p className="business-empty">Crea tu primera empresa para empezar.</p>}
      </section>
    </div>
  </>
}

export default function AdvisorAccountPage() {
  const { user, isLoading, isAuthenticated, logout } = useAuth()
  const [tab, setTab] = useState<'overview' | 'clients' | 'create' | 'commissions'>('overview')
  const [menuOpen, setMenuOpen] = useState(false)
  const [data, setData] = useState<AdvisorDashboard | null>(null), [catalog, setCatalog] = useState<AdvisorCatalog | null>(null)
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [revision, setRevision] = useState(0)
  const [notice, setNotice] = useState<{ status: 'SENT' | 'FAILED'; message: string } | null>(null)
  useEffect(() => {
    if (!isAuthenticated || !isAdvisorRole(user?.role)) return
    let cancelled = false
    void Promise.all([fetchAdvisorDashboard(), fetchAdvisorCatalog()]).then(([dashboard, available]) => { if (!cancelled) { setData(dashboard); setCatalog(available) } }).catch(failure => { if (!cancelled) setError(getApiErrorMessage(failure, 'No se pudo cargar tu panel.')) }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [isAuthenticated, user?.id, user?.role, revision])
  if (isLoading) return <LoadingIndicator message="Validando acceso…" />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!isAdvisorRole(user?.role)) return <Navigate to="/inicio" replace />
  const sections = [{ id: 'overview', label: 'Resumen', Icon: HomeIcon }, { id: 'clients', label: 'Mis clientes', Icon: AdminIcon }, { id: 'create', label: 'Crear empresa', Icon: PackageIcon }, { id: 'commissions', label: 'Mis comisiones', Icon: AdminIcon }] as const
  return <div className="admin-shell advisor-shell"><aside className="admin-sidebar" aria-label="Panel de asesor"><div className="admin-sidebar__brand"><img src="/logo5.png" alt="Jarvis" /><span>Panel de asesor</span><button type="button" className="admin-sidebar__toggle" aria-expanded={menuOpen} aria-controls="advisor-menu" onClick={() => setMenuOpen(value => !value)}>{menuOpen ? 'Cerrar menú' : 'Abrir menú'}</button></div>
    <div id="advisor-menu" className={`admin-sidebar__menu${menuOpen ? ' admin-sidebar__menu--open' : ''}`}><span className="admin-sidebar__caption">MI NEGOCIO</span><nav className="admin-sidebar__sections" aria-label="Secciones de asesor">{sections.map(({ id, label, Icon }) => <button type="button" key={id} aria-current={tab === id ? 'page' : undefined} onClick={() => { setTab(id); setMenuOpen(false); setNotice(null) }}><Icon /><span>{label}</span></button>)}</nav><div className="admin-sidebar__footer"><button type="button" onClick={logout}>Cerrar sesión</button></div></div></aside>
    <main className="admin-page advisor-panel"><PageHeader eyebrow="Panel de asesor" title={tab === 'overview' ? `Hola, ${user?.name ?? 'asesor'}` : sections.find(item => item.id === tab)?.label} actions={<Button variant="outline" disabled={loading} onClick={() => { setLoading(true); setError(''); setRevision(value => value + 1) }}>Actualizar</Button>} />
    {error && <ErrorMessage inline message={error} />}{notice && <Banner variant={notice.status === 'SENT' ? 'success' : 'warning'} message={notice.message} />}
    {loading ? <LoadingIndicator message="Cargando tu panel…" /> : data && catalog && <div key={tab}>
      {tab === 'overview' && <AdvisorOverview data={data} onClients={() => setTab('clients')} onCreate={() => setTab('create')} onCommissions={() => setTab('commissions')} />}
      {tab === 'clients' && <AdvisorClients clients={data.clients} onCreate={() => setTab('create')} />}
      {tab === 'create' && <CreateCompanyForm advisor plans={catalog.plans} cities={catalog.cities} topUpCatalog={catalog.topUps} onCancel={() => setTab('clients')} createCompany={createAdvisorCompany} lookupName={lookupAdvisorCompanyName}
        selectionSummary={(plans, topUps) => <AdvisorCommissionPreview plans={plans} topUps={topUps} rates={catalog.commissionRates} topUpCommissionBasis={catalog.topUpCommissionBasis} />}
        onCreated={response => { setNotice(response.welcome ?? { status: 'SENT', message: `Empresa ${response.company.name} creada.` }); setTab('clients'); setRevision(value => value + 1) }} />}
      {tab === 'commissions' && <CommissionReport onPaid={() => setRevision(value => value + 1)} />}
    </div>}
    <footer className="advisor-panel__footer">{colombiaToday()} · Jarvis Comercial</footer>
  </main></div>
}
