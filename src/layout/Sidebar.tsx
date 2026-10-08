import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { type ChangeEvent, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useIntegrationSetup } from '../context/IntegrationSetupContext'
import { WHATSAPP_SUPPORT_HREF } from '../constants/contact'
import { PRIVACY_POLICY_URL } from '../constants/privacyPolicy'
import {
  AdminIcon,
  ChevronDownIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  DocumentIcon,
  HelpIcon,
  PackageIcon,
  // PulseIcon,
  SettingsIcon,
} from '../components/icons/SidebarIcons'
import { isAdminRole } from '../constants/userRole'

// const BANK_STATEMENTS_ROOT = '/extractos-bancarios'
// const BANK_STATEMENT_CHILDREN = [
//   { label: 'Cargar extracto', to: '/extractos-bancarios/cargar' },
//   { label: 'Historial de cierres', to: '/extractos-bancarios/historial' },
// ]

const PRODUCTS_ROOT = '/productos'

const SIDEBAR_LOGO_SRC = '/logo5.png'

interface NavItemChild {
  label: string
  to: string
}

interface NavItem {
  label: string
  to: string
  icon: (props: { className?: string }) => React.JSX.Element
  featureEnabled?: boolean
  children?: NavItemChild[]
}

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
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})
  const { user, companies, isLoading, isSwitchingCompany, logout, switchCompany } =
    useAuth()
  const {
    isSupportDocumentEnabled,
    isPurchaseInvoiceEnabled,
    isSalesInvoiceEnabled,
    isCreditNoteEnabled,
    hasSupportDocumentAccess,
    hasPurchaseInvoiceAccess,
    requiresSetup,
    setupPath,
    isJarvisCompany,
    isConfigured,
    isSubscriptionActive,
    documentQuotas,
    documentLimit: totalDocumentLimit,
    documentsUsed: totalDocumentsUsed,
    documentsRemaining: totalDocumentsRemaining,
  } = useIntegrationSetup()
  const companyName = user?.company?.name ?? 'Mi Empresa'
  const activeCompanyId = user?.company?.id ?? ''
  const userName = user?.name?.trim() || 'Usuario'
  const userEmail = user?.email?.trim() || ''
  const settingsLabel = isJarvisCompany ? 'Configuración' : 'Configuración SIIGO'
  const showUsageIndicator = isConfigured && isSubscriptionActive
  const activeQuota = !isJarvisCompany ? documentQuotas[location.pathname.startsWith('/factura-compra') ? 'PURCHASE_INVOICE' : 'SUPPORT_DOCUMENT'] : undefined
  const documentLimit = activeQuota ? activeQuota.documentLimit : totalDocumentLimit
  const documentsUsed = activeQuota ? activeQuota.documentsUsed : totalDocumentsUsed
  const documentsRemaining = activeQuota ? activeQuota.remaining : totalDocumentsRemaining
  const quotaLabel = activeQuota ? (location.pathname.startsWith('/factura-compra') ? 'facturas de compra' : 'documentos soporte') : 'documentos'
  const isUnlimited = documentLimit == null
  const limit = documentLimit ?? 0
  const remaining = documentsRemaining ?? (isUnlimited ? null : Math.max(0, limit - documentsUsed))
  const usagePercent = isUnlimited || limit <= 0
    ? 0
    : Math.min(100, Math.round((documentsUsed / limit) * 100))
  const usageTone: 'normal' | 'warning' | 'danger' = isUnlimited
    ? 'normal'
    : remaining === 0
      ? 'danger'
      : remaining !== null && limit > 0 && (remaining <= 5 || remaining / limit <= 0.1)
        ? 'warning'
        : 'normal'

  const navItems: NavItem[] = [
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
            featureEnabled: isSupportDocumentEnabled,
          },
        ]
      : []),
    // Factura de compra es el flujo de SIIGO; en Jarvis ese mismo tipo de
    // documento del plan corresponde a Factura de venta (la que se emite con
    // la resolución de factura electrónica).
    ...(hasPurchaseInvoiceAccess && !isJarvisCompany
      ? [
          {
            label: 'Factura de compra',
            to: '/factura-compra',
            icon: DocumentIcon,
            featureEnabled: isPurchaseInvoiceEnabled,
          },
        ]
      : []),
    ...(isJarvisCompany
      ? [
          {
            label: 'Factura de venta',
            to: '/factura-venta',
            icon: DocumentIcon,
            featureEnabled: isSalesInvoiceEnabled,
          },
          { label: 'Nota débito', to: '/nota-debito', icon: DocumentIcon, featureEnabled: isSalesInvoiceEnabled },
        ]
      : []),
    ...(isCreditNoteEnabled
      ? [
          {
            label: 'Nota crédito',
            to: '/nota-credito',
            icon: DocumentIcon,
            featureEnabled: isCreditNoteEnabled,
          },
        ]
      : []),
    ...(!isAdminRole(user?.role) && (isJarvisCompany || isCreditNoteEnabled)
      ? [{
          label: 'Categorías',
          to: 'categorias',
          icon: PackageIcon,
          children: [
            ...(isJarvisCompany
              ? [
                  { label: 'Productos', to: '/productos/listar' },
                  { label: 'Impuestos y retenciones', to: '/impuestos-retenciones' },
                  { label: 'Formas de pago', to: '/formas-de-pago' },
                ]
              : []),
            { label: 'Terceros', to: '/terceros' },
          ],
        }]
      : []),
    // Extractos bancarios oculto temporalmente a pedido explícito — la ruta y
    // la página siguen intactas, solo se saca el ítem del menú (ver las
    // constantes comentadas arriba para volver a habilitarlo).
    ...(isAdminRole(user?.role)
      ? [
          {
            label: 'Administración',
            to: '/admin',
            icon: AdminIcon,
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

    if (to === '/factura-compra') {
      return location.pathname.startsWith('/factura-compra')
    }

    if (to === '/terceros') {
      return location.pathname.startsWith('/terceros')
    }

    if (to === '/productos/listar') {
      // También queda activo en "Crear producto" (accesible desde el botón
      // del listado, ya no desde un submenú acá) — sigue siendo la misma
      // sección para el usuario.
      return location.pathname.startsWith(PRODUCTS_ROOT)
    }

    return location.pathname === to
  }

  const renderNavItems = (iconOnly: boolean) =>
    navItems.map((item) => {
      const Icon = item.icon

      if ('children' in item && item.children) {
        const groupActive = item.children.some(child => isActive(child.to))
        const groupKey = location.pathname + ':' + item.to
        const isExpanded = expandedGroups[groupKey] ?? groupActive
        const groupId = 'sidebar-group-' + item.to

        if (iconOnly) {
          return (
            <button
              key={item.to}
              type="button"
              className="app-sidebar__link app-sidebar__link--icon-only app-sidebar__group-toggle"
              title={item.label}
              aria-label={`Abrir ${item.label}`}
              aria-expanded={false}
              onClick={() => {
                setExpandedGroups(current => ({ ...current, [groupKey]: true }))
                onOpen()
              }}
            >
              <Icon className="app-sidebar__link-icon" />
            </button>
          )
        }

        return (
          <div key={item.to} className="app-sidebar__group">
            <button
              type="button"
              className={[
                'app-sidebar__link',
                'app-sidebar__group-toggle',
                groupActive ? 'app-sidebar__group-toggle--active' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => setExpandedGroups(current => ({ ...current, [groupKey]: !isExpanded }))}
              aria-controls={isExpanded ? groupId : undefined}
              aria-expanded={isExpanded}
            >
              <Icon className="app-sidebar__link-icon" />
              <span>{item.label}</span>
              <ChevronDownIcon
                className={[
                  'app-sidebar__group-chevron',
                  isExpanded ? 'app-sidebar__group-chevron--open' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              />
            </button>

            {isExpanded && (
              <div id={groupId} className="app-sidebar__group-children">
                {item.children.map((child) => (
                  <NavLink
                    key={child.to}
                    to={child.to}
                    className={() =>
                      [
                        'app-sidebar__child-link',
                        isActive(child.to) ? 'app-sidebar__child-link--active' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')
                    }
                  >
                    <span className="app-sidebar__child-dot" aria-hidden="true" />
                    {child.label}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        )
      }

      const isDisabledByFeature =
        'featureEnabled' in item && item.featureEnabled === false
      const isDisabledByJarvis =
        'requiresJarvisSetup' in item &&
        item.requiresJarvisSetup &&
        !isConfigured
      const isDisabled = isDisabledByFeature || isDisabledByJarvis
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
                  ? 'Requiere plan activo y configuración completa de Jarvis'
                  : 'Requiere plan activo, credenciales SIIGO y cuentas sincronizadas'
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
              title="Ocultar menú"
            >
              {/* Doble flecha hacia la izquierda: apunta hacia donde se va el
                  panel al esconderse. El icono anterior (un rectángulo con
                  una división) no dejaba claro qué hacía el botón. */}
              <ChevronsLeftIcon className="app-sidebar__collapse-icon" />
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
          {showUsageIndicator && (
            <div className={`app-sidebar__usage app-sidebar__usage--${usageTone}`}>
              <div className="app-sidebar__usage-header">
                <DocumentIcon className="app-sidebar__usage-icon" />
                <span className="app-sidebar__usage-label">
                  {isUnlimited
                    ? `${quotaLabel.charAt(0).toUpperCase() + quotaLabel.slice(1)} ilimitados`
                    : `${remaining} de ${limit} ${quotaLabel} disponibles`}
                </span>
              </div>
              {!isUnlimited && (
                <div
                  className="app-sidebar__usage-bar"
                  role="progressbar"
                  aria-valuenow={usagePercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Documentos usados del plan"
                >
                  <div
                    className="app-sidebar__usage-bar-fill"
                    style={{ width: `${usagePercent}%` }}
                  />
                </div>
              )}
            </div>
          )}

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
                <a
                  href={WHATSAPP_SUPPORT_HREF}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="app-sidebar__help-link"
                >
                  Escríbenos por WhatsApp
                </a>
                <a
                  href={PRIVACY_POLICY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="app-sidebar__help-link"
                >
                  Política de datos
                </a>
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
            {/* Espejo del botón de ocultar: apunta hacia la derecha, que es
                hacia donde se despliega el panel. */}
            <ChevronsRightIcon className="app-sidebar__rail-tab-icon" />
          </button>
        </div>
      )}
    </aside>
  )
}

export default Sidebar
