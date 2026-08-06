import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { type ChangeEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { useIntegrationSetup } from '../context/IntegrationSetupContext'
import {
  DocumentIcon,
  HelpIcon,
  PanelLeftIcon,
  SettingsIcon,
  SuppliersIcon,
} from '../components/icons/SidebarIcons'

const SIDEBAR_LOGO_SRC = '/logo5.png'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
  onOpen: () => void
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

function Sidebar({ isOpen, onClose, onOpen }: SidebarProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, companies, isLoading, isSwitchingCompany, logout, switchCompany } =
    useAuth()
  const {
    isSupportDocumentEnabled,
    hasSupportDocumentAccess,
    requiresSetup,
    setupPath,
    isJarvisCompany,
    isConfigured,
  } = useIntegrationSetup()
  const companyName = user?.company?.name ?? 'Mi Empresa'
  const activeCompanyId = user?.company?.id ?? ''
  const userName = user?.name?.trim() || 'Usuario'
  const userEmail = user?.email?.trim() || ''
  const settingsLabel = isJarvisCompany ? 'Configuración' : 'Configuración SIIGO'

  const navItems = [
    {
      label: settingsLabel,
      to: setupPath,
      icon: SettingsIcon,
    },
    ...(hasSupportDocumentAccess
      ? [
          {
            label: 'Documento soporte',
            to: '/documento-soporte',
            icon: DocumentIcon,
            requiresSiigoSetup: true as const,
          },
        ]
      : []),
    ...(isJarvisCompany
      ? [
          {
            label: 'Terceros',
            to: '/terceros',
            icon: SuppliersIcon,
            requiresJarvisSetup: true as const,
          },
        ]
      : []),
  ]

  const handleCompanyChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextCompanyId = event.target.value

    if (!nextCompanyId || nextCompanyId === activeCompanyId) {
      return
    }

    void switchCompany(nextCompanyId)
  }

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const isActive = (to: string) => {
    if (to === '/documento-soporte') {
      return location.pathname.startsWith('/documento-soporte')
    }

    if (to === '/terceros') {
      return location.pathname.startsWith('/terceros')
    }

    return location.pathname === to
  }

  const renderNavItems = (iconOnly: boolean) =>
    navItems.map((item) => {
      const Icon = item.icon
      const isDisabledBySiigo =
        'requiresSiigoSetup' in item &&
        item.requiresSiigoSetup &&
        !isSupportDocumentEnabled
      const isDisabledByJarvis =
        'requiresJarvisSetup' in item &&
        item.requiresJarvisSetup &&
        !isConfigured
      const isDisabled = isDisabledBySiigo || isDisabledByJarvis
      const active = !isDisabled && isActive(item.to)
      const linkClass = [
        'app-sidebar__link',
        iconOnly ? 'app-sidebar__link--icon-only' : '',
        active ? 'app-sidebar__link--active' : '',
        isDisabled ? 'app-sidebar__link--disabled' : '',
      ]
        .filter(Boolean)
        .join(' ')

      if (isDisabled) {
        return (
          <span
            key={item.label}
            className={linkClass}
            aria-disabled="true"
            title={
              isDisabledByJarvis
                ? 'Complete todos los pasos de configuración Jarvis para continuar'
                : isJarvisCompany
                  ? 'Requiere plan activo con documento soporte y configuración completa de Jarvis'
                  : 'Requiere plan activo (Documento soporte), credenciales SIIGO y cuentas sincronizadas'
            }
          >
            <Icon className="app-sidebar__link-icon" />
            {!iconOnly && <span>{item.label}</span>}
          </span>
        )
      }

      return (
        <NavLink
          key={item.to}
          to={item.to}
          className={linkClass}
          title={iconOnly ? item.label : undefined}
          aria-label={iconOnly ? item.label : undefined}
        >
          <Icon className="app-sidebar__link-icon" />
          {!iconOnly && <span>{item.label}</span>}
        </NavLink>
      )
    })

  return (
    <aside
      className={`app-sidebar${isOpen ? '' : ' app-sidebar--collapsed'}`}
      aria-label="Menú principal"
    >
      <div className="app-sidebar__brand">
        <button
          type="button"
          className="app-sidebar__brand-logo-btn"
          onClick={isOpen ? undefined : onOpen}
          aria-label={isOpen ? undefined : 'Mostrar menú lateral'}
          title={isOpen ? undefined : 'Mostrar menú'}
          disabled={isOpen}
        >
          <img
            src={SIDEBAR_LOGO_SRC}
            alt="Jarvis"
            className="app-sidebar__brand-logo"
          />
        </button>

        {isOpen && (
          <div className="app-sidebar__brand-row">
            {companies.length > 0 ? (
              <select
                className="app-sidebar__company-select"
                value={activeCompanyId}
                onChange={handleCompanyChange}
                disabled={isLoading || isSwitchingCompany || companies.length === 0}
                aria-label="Empresa activa"
                title={companyName}
              >
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            ) : (
              <span className="app-sidebar__brand-title" title={companyName}>
                {isLoading ? 'Cargando...' : companyName}
              </span>
            )}
            <button
              type="button"
              className="app-sidebar__collapse-btn"
              onClick={onClose}
              aria-label="Ocultar menú lateral"
            >
              <PanelLeftIcon className="app-sidebar__collapse-icon" />
            </button>
          </div>
        )}
      </div>

      <nav
        className={`app-sidebar__nav${isOpen ? '' : ' app-sidebar__nav--rail'}`}
        aria-label="Navegación principal"
      >
        {renderNavItems(!isOpen)}
      </nav>

      {isOpen ? (
        <>
          {requiresSetup && (
            <p className="app-sidebar__setup-hint">
              {isJarvisCompany
                ? 'Finalice los pasos de configuración (empresa y resoluciones) para habilitar el resto.'
                : 'Configure las credenciales de SIIGO y un plan con documento soporte para habilitar Documento soporte.'}
            </p>
          )}

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
        </>
      ) : (
        <div className="app-sidebar__rail-footer">
          <button
            type="button"
            className="app-sidebar__rail-expand"
            onClick={onOpen}
            aria-label="Mostrar menú lateral"
            title="Mostrar menú"
          >
            <PanelLeftIcon className="app-sidebar__rail-tab-icon" />
          </button>
        </div>
      )}
    </aside>
  )
}

export default Sidebar
