import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { isAdvisorRole } from '../constants/userRole'
import { getApiErrorMessage } from '../services/apiClient'
import { fetchAdvisorDemo } from '../services/advisorService'
import LoadingIndicator from '../components/LoadingIndicator'
import ErrorMessage from '../components/ErrorMessage'
import Banner from '../components/Banner'
import PageHeader from '../components/PageHeader'
import { DocumentIcon, HomeIcon } from '../components/icons/SidebarIcons'
import AdvisorDemoInvoices from './AdvisorDemoInvoices'
import './AdminPage.css'
import '../components/AdminSidebar.css'
import './AdvisorDemoPage.css'

export default function AdvisorDemoPage() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const [company, setCompany] = useState<{ name: string; isDemo: boolean } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [billingOpen, setBillingOpen] = useState(true)
  const [section, setSection] = useState<'home' | 'invoices'>('home')

  useEffect(() => {
    if (!isAuthenticated || !isAdvisorRole(user?.role)) return
    let active = true
    void Promise.resolve().then(() => {
      if (!active) return
      setLoading(true)
      setError('')
      return fetchAdvisorDemo()
    }).then(result => {
      if (active && result) setCompany(result.company)
    }).catch(failure => {
      if (active) { setCompany(null); setError(getApiErrorMessage(failure, 'No se pudo cargar la empresa demo.')) }
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [isAuthenticated, user?.id, user?.role, attempt])

  if (isLoading) return <LoadingIndicator message="Validando acceso…" />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!isAdvisorRole(user?.role)) return <Navigate to="/inicio" replace />

  return <div className="admin-shell advisor-demo">
    <aside className="admin-sidebar" aria-label="Menú de la aplicación demo">
      <div className="admin-sidebar__brand">
        <img src="/logo5.png" alt="Jarvis" />
        <span>{company?.name ?? 'Aplicación demo'}</span>
        <button type="button" className="admin-sidebar__toggle" aria-expanded={menuOpen} aria-controls="demo-menu" onClick={() => setMenuOpen(value => !value)}>{menuOpen ? 'Cerrar menú' : 'Abrir menú'}</button>
      </div>
      <div id="demo-menu" className={`admin-sidebar__menu${menuOpen ? ' admin-sidebar__menu--open' : ''}`}>
        <span className="admin-sidebar__caption">APLICACIÓN DEMO</span>
        <nav className="admin-sidebar__sections" aria-label="Facturación electrónica">
          <button type="button" aria-current={section === 'home' ? 'page' : undefined} onClick={() => { setSection('home'); setMenuOpen(false) }}><HomeIcon /><span>Inicio</span></button>
          <button type="button" aria-expanded={billingOpen} aria-controls="demo-billing-menu" onClick={() => setBillingOpen(value => !value)}><DocumentIcon /><span>Documentos electrónicos</span></button>
          {billingOpen && <div id="demo-billing-menu" className="advisor-demo__menu-group">
            <span>Factura de venta</span>
            <button type="button" aria-current={section === 'invoices' ? 'page' : undefined} onClick={() => { setSection('invoices'); setMenuOpen(false) }}>Facturas de venta</button>
            <span aria-disabled="true">Notas crédito</span>
            <span aria-disabled="true">Notas débito</span>
            <span>Documento soporte</span>
            <span aria-disabled="true">Documentos soporte</span>
            <span aria-disabled="true">Notas de ajuste</span>
            <span aria-disabled="true">Eventos RADIAN</span>
          </div>}
        </nav>
        <div className="admin-sidebar__footer"><Link to="/asesor">← Volver al panel comercial</Link></div>
      </div>
    </aside>
    <main className="admin-page integration-page">
      <PageHeader eyebrow="Aplicación demo" title="Facturación electrónica" description={company?.name} />
      <Banner variant="warning" message="Modo demo: no se conecta a NextPyme ni a la DIAN. Los documentos de demostración no tienen validez tributaria." />
      {loading && <LoadingIndicator message="Cargando empresa demo…" />}
      {error && <div className="advisor-demo__error"><ErrorMessage inline message={error} /><button type="button" className="btn btn--outline btn--md" onClick={() => setAttempt(value => value + 1)}>Reintentar</button></div>}
      {!loading && company && section === 'invoices' && <AdvisorDemoInvoices />}
      {!loading && company && section === 'home' && <section className="admin-card advisor-demo__welcome">
        <h2>Bienvenido a {company.name}</h2>
        <p>Este espacio está separado de las empresas y documentos reales.</p>
        <p>Puedes crear facturas simuladas desde el menú. Las demás opciones se habilitarán cuando su simulación esté disponible.</p>
      </section>}
    </main>
  </div>
}
