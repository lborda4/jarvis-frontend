import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  AccountsIcon,
  CompanyLogoIcon,
  DocumentIcon,
  HelpIcon,
  HomeIcon,
  IntegrationsIcon,
  InvoiceIcon,
  PanelLeftIcon,
  SettingsIcon,
  SuppliersIcon,
} from '../components/icons/SidebarIcons'

const NAV_ITEMS = [
  { label: 'Inicio', to: '/', icon: HomeIcon, disabled: true },
  { label: 'Facturas de compra', to: '/facturas/importar', icon: InvoiceIcon },
  { label: 'Documento soporte', to: '/documento-soporte', icon: DocumentIcon },
  { label: 'Proveedores', to: '/proveedores', icon: SuppliersIcon, disabled: true },
  {
    label: 'Cuentas contables',
    to: '/cuentas-contables',
    icon: AccountsIcon,
    disabled: true,
  },
  { label: 'Integraciones', to: '/integraciones', icon: IntegrationsIcon, disabled: true },
  {
    label: 'Configuración',
    to: '/configuracion/integracion-siigo',
    icon: SettingsIcon,
  },
]

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

function getUserInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)

  if (parts.length === 0) {
    return 'U'
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }

  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
}

function Sidebar({ isOpen, onClose }: SidebarProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, isLoading, logout } = useAuth()
  const companyName = user?.company?.name ?? 'Mi Empresa'
  const userName = user?.name?.trim() || 'Usuario'
  const userEmail = user?.email?.trim() || ''

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const isActive = (to: string) => {
    if (to === '/documento-soporte') {
      return location.pathname.startsWith('/documento-soporte')
    }

    if (to === '/facturas/importar') {
      return location.pathname.startsWith('/facturas')
    }

    return location.pathname === to
  }

  return (
    <aside
      className={`app-sidebar${isOpen ? '' : ' app-sidebar--collapsed'}`}
      aria-label="Menú principal"
      aria-hidden={!isOpen}
    >
      <div className="app-sidebar__brand">
        <CompanyLogoIcon className="app-sidebar__brand-icon" />
        <span className="app-sidebar__brand-title" title={companyName}>
          {isLoading ? 'Cargando...' : companyName}
        </span>
        <button
          type="button"
          className="app-sidebar__collapse-btn"
          onClick={onClose}
          aria-label="Ocultar menú lateral"
        >
          <PanelLeftIcon className="app-sidebar__collapse-icon" />
        </button>
      </div>

      <nav className="app-sidebar__nav">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const active = !item.disabled && isActive(item.to)

          if (item.disabled) {
            return (
              <span
                key={item.label}
                className="app-sidebar__link app-sidebar__link--disabled"
                aria-disabled="true"
              >
                <Icon className="app-sidebar__link-icon" />
                <span>{item.label}</span>
              </span>
            )
          }

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`app-sidebar__link${active ? ' app-sidebar__link--active' : ''}`}
            >
              <Icon className="app-sidebar__link-icon" />
              <span>{item.label}</span>
            </NavLink>
          )
        })}
      </nav>

      <div className="app-sidebar__footer">
        <div className="app-sidebar__help">
          <HelpIcon className="app-sidebar__help-icon" />
          <div>
            <p className="app-sidebar__help-title">¿Necesitas ayuda?</p>
            <button type="button" className="app-sidebar__help-link">
              Visita nuestra guía
            </button>
          </div>
        </div>

        <div className="app-sidebar__profile">
          <span className="app-sidebar__avatar" aria-hidden="true">
            {getUserInitials(userName)}
          </span>
          <span className="app-sidebar__profile-info">
            <span className="app-sidebar__profile-name">
              {isLoading ? 'Cargando...' : userName}
            </span>
            {userEmail && (
              <span className="app-sidebar__profile-role">{userEmail}</span>
            )}
          </span>
        </div>

        <button
          type="button"
          className="app-sidebar__logout-btn"
          onClick={handleLogout}
          disabled={isLoading}
        >
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
