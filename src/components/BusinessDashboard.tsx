import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import type { AdminCompanyListItem } from '../types/admin'
import { colombiaToday, companyTrackingStatus, trackingDueDate, TRACKING_STATUS_LABELS } from '../utils/companyTracking'
import Button from './Button'
import './BusinessDashboard.css'

export function BusinessMetrics({ items }: { items: { label: string; value: ReactNode; detail: string; tone?: 'warning' | 'danger' | 'primary'; onClick?: () => void }[] }) {
  return <div className="business-metrics">{items.map(item => {
    const content = <><span>{item.label}</span><strong>{item.value}</strong><small>{item.detail}</small>{item.onClick && <span className="business-metrics__arrow" aria-hidden="true">↗</span>}</>
    return item.onClick ? <button type="button" key={item.label} className={`business-metrics__card business-metrics__card--${item.tone ?? 'primary'}`} onClick={item.onClick}>{content}</button> : <article key={item.label} className={`business-metrics__card business-metrics__card--${item.tone ?? 'primary'}`}>{content}</article>
  })}</div>
}

export function AdminBusinessOverview({ companies, onClients, onCreate, onAdvisors, onCommissions }: { companies: AdminCompanyListItem[]; onClients: (status?: string) => void; onCreate: () => void; onAdvisors: () => void; onCommissions: () => void }) {
  const today = colombiaToday()
  const urgent = companies.filter(company => ['OVERDUE', 'DUE_TODAY', 'DUE_SOON'].includes(companyTrackingStatus(company, today))).sort((a, b) => (trackingDueDate(a) ?? '').localeCompare(trackingDueDate(b) ?? ''))
  const overdue = urgent.filter(company => companyTrackingStatus(company, today) === 'OVERDUE').length
  const unassigned = companies.filter(company => !company.advisorId).length
  const recent = [...companies].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5)
  return <>
    <BusinessMetrics items={[
      { label: 'Clientes', value: companies.length, detail: 'Ver cartera de clientes', onClick: () => onClients() },
      { label: 'Por vencer', value: urgent.length - overdue, detail: 'Hoy y próximos 7 días', tone: 'warning', onClick: () => onClients('UPCOMING') },
      { label: 'Vencidos', value: overdue, detail: 'Requieren seguimiento', tone: 'danger', onClick: () => onClients('OVERDUE') },
      { label: 'Sin asesor', value: unassigned, detail: 'Asignar al equipo comercial', onClick: onAdvisors },
    ]} />
    <section className="business-action-bar"><div><h2>Gestiona tu negocio</h2><p>Clientes, recargas y comisiones.</p></div><div className="business-actions"><Button variant="outline" onClick={onCommissions}>Pagos y comisiones</Button><Button onClick={onCreate}>+ Crear empresa</Button></div></section>
    <div className="business-dashboard__columns">
      <section className="admin-card business-list"><div className="business-section-heading"><h2>Renovaciones por atender</h2><Button variant="ghost" onClick={() => onClients()}>Ver seguimiento</Button></div>
        {urgent.slice(0, 6).map(company => <Link className="business-list__row" key={company.id} to={`/admin/clientes/${encodeURIComponent(company.id)}`}><span><strong>{company.name}</strong><small>{company.commercial || 'Sin asesor'} · NIT {company.nit}</small></span><span><span className={`business-badge business-badge--${companyTrackingStatus(company, today) === 'OVERDUE' ? 'danger' : 'warning'}`}>{TRACKING_STATUS_LABELS[companyTrackingStatus(company, today)]}</span><small>{trackingDueDate(company)}</small></span></Link>)}
        {!urgent.length && <p className="business-empty">Sin vencimientos pendientes esta semana.</p>}
      </section>
      <section className="admin-card business-list"><div className="business-section-heading"><h2>Clientes recientes</h2><Button variant="ghost" onClick={() => onClients()}>Ver todos</Button></div>
        {recent.map(company => <Link className="business-list__row" key={company.id} to={`/admin/clientes/${encodeURIComponent(company.id)}`}><span><strong>{company.name}</strong><small>NIT {company.nit}</small></span><span className="business-badge">{company.integrations.map(item => item.provider).join(' / ') || 'Sin integración'}</span></Link>)}
        {!recent.length && <div className="business-empty"><p>Aún no tienes clientes.</p><Button onClick={onCreate}>Crear primera empresa</Button></div>}
      </section>
    </div>
  </>
}
