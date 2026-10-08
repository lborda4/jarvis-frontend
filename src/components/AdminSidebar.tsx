import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AdminIcon, DocumentIcon, HomeIcon, PackageIcon } from './icons/SidebarIcons'
import './AdminSidebar.css'

const sections = [
  { id: 'jarvis', label: 'Jarvis', Icon: PackageIcon },
  { id: 'catalog', label: 'Catálogo', Icon: DocumentIcon },
  { id: 'bold', label: 'Bold', Icon: HomeIcon },
  { id: 'tracking', label: 'Seguimiento', Icon: AdminIcon },
] as const
type Section = typeof sections[number]['id']

export default function AdminSidebar({ active, onChange, onLogout }: {
  active: Section; onChange: (section: Section) => void; onLogout: () => void
}) {
  const [open, setOpen] = useState(false)
  return <aside className="admin-sidebar" aria-label="Panel de administración">
    <div className="admin-sidebar__brand">
      <img src="/logo5.png" alt="Jarvis" />
      <span>Panel de administración</span>
      <button className="admin-sidebar__toggle" type="button" aria-expanded={open} aria-controls="admin-sidebar-menu" onClick={() => setOpen(value => !value)}>{open ? 'Cerrar menú' : 'Abrir menú'}</button>
    </div>
    <div id="admin-sidebar-menu" className={`admin-sidebar__menu${open ? ' admin-sidebar__menu--open' : ''}`}>
      <span className="admin-sidebar__caption">ADMINISTRACIÓN</span>
      <div className="admin-sidebar__sections" role="tablist" aria-label="Secciones de administración" aria-orientation="vertical">
        {sections.map(({ id, label, Icon }, index) => <button key={id} id={`admin-tab-${id}`} type="button" role="tab" aria-selected={active === id} aria-controls={`admin-panel-${id}`} tabIndex={active === id ? 0 : -1}
          onClick={() => { onChange(id); setOpen(false) }} onKeyDown={event => {
            if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return
            event.preventDefault()
            const next = event.key === 'Home' ? sections[0] : event.key === 'End' ? sections[sections.length - 1] : sections[(index + (event.key === 'ArrowDown' ? 1 : sections.length - 1)) % sections.length]
            onChange(next.id)
            document.getElementById(`admin-tab-${next.id}`)?.focus()
          }}><Icon /><span>{label}</span></button>)}
      </div>
      <div className="admin-sidebar__footer">
        <Link to="/inicio"><span aria-hidden="true">←</span> Volver a la aplicación</Link>
        <button type="button" onClick={onLogout}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4M9 12h11m-4-4 4 4-4 4" strokeLinecap="round" strokeLinejoin="round" /></svg>Cerrar sesión</button>
      </div>
    </div>
  </aside>
}
