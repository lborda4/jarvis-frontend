import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useIntegrationSetup } from '../context/IntegrationSetupContext'
import { companyJarvisModules } from '../types/companyModules'
import { ChevronDownIcon } from './icons/SidebarIcons'
import { PlusIcon } from './icons/ImportIcons'
import './DashboardCreateMenu.css'

export default function DashboardCreateMenu() {
  const { user } = useAuth()
  const setup = useIntegrationSetup()
  const detailsRef = useRef<HTMLDetailsElement>(null)
  const modules = companyJarvisModules(user?.company?.jarvisModules)
  const billing = setup.isJarvisCompany && modules.includes('BILLING')
  const ready = !setup.isCheckingSetup && setup.integrationMode !== 'unknown'
  const documents = [
    { label: 'Factura de venta', to: '/factura-venta/nueva', enabled: billing && setup.isSalesInvoiceEnabled },
    { label: 'Nota crédito', to: '/nota-credito/nueva', enabled: billing && setup.isCreditNoteEnabled },
    { label: 'Nota débito', to: '/nota-debito/nueva', enabled: billing && setup.isSalesInvoiceEnabled },
    { label: 'Documento soporte', to: '/documento-soporte/nuevo', enabled: billing && setup.isSupportDocumentEnabled },
    { label: 'Nota de ajuste', to: '/nota-ajuste/nueva', enabled: billing && setup.isSupportDocumentEnabled },
    { label: 'Nómina electrónica', to: '/nomina/nueva', enabled: setup.isJarvisCompany && modules.includes('PAYROLL') },
    { label: 'Evento RADIAN', to: '/eventos-radian', enabled: billing && setup.isJarvisCompanyConfigured },
  ].filter(item => ready && item.enabled)
  const catalogs = billing && ready && setup.isConfigured ? [
    { label: 'Tercero (cliente o proveedor)', to: '/terceros?create=1' },
    { label: 'Producto o servicio', to: '/productos/listar?create=1' },
    { label: 'Impuesto o retención', to: '/impuestos-retenciones?create=1' },
    { label: 'Forma de pago', to: '/formas-de-pago?create=1' },
  ] : []

  useEffect(() => {
    const dismissOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !detailsRef.current?.contains(event.target)) {
        detailsRef.current?.removeAttribute('open')
      }
    }
    const dismissWithEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && detailsRef.current?.open) {
        detailsRef.current.open = false
        detailsRef.current.querySelector('summary')?.focus()
      }
    }
    document.addEventListener('pointerdown', dismissOutside)
    document.addEventListener('keydown', dismissWithEscape)
    return () => {
      document.removeEventListener('pointerdown', dismissOutside)
      document.removeEventListener('keydown', dismissWithEscape)
    }
  }, [])

  if (!documents.length && !catalogs.length) {
    return <button className="dashboard-create__trigger" type="button" disabled title="No hay opciones de creación habilitadas"><PlusIcon />Crear<ChevronDownIcon /></button>
  }

  return <details className="dashboard-create" ref={detailsRef}>
    <summary className="dashboard-create__trigger"><PlusIcon />Crear<ChevronDownIcon /></summary>
    <nav className="dashboard-create__panel" aria-label="Crear documentos y catálogos" onClick={event => {
      if ((event.target as Element).closest('a') && detailsRef.current) detailsRef.current.open = false
    }}>
      {[{ title: 'Documentos electrónicos', items: documents }, { title: 'Catálogos', items: catalogs }].filter(group => group.items.length).map(group => <section className="dashboard-create__group" key={group.title}>
        <h2>{group.title}</h2>
        <ul>{group.items.map(item => <li key={item.to}><Link to={item.to}>{item.label}</Link></li>)}</ul>
      </section>)}
    </nav>
  </details>
}
