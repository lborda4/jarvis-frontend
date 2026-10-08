import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { INTEGRATION_PROVIDER, type AdminCompanyListItem } from '../types/admin'
import PageHeader from './PageHeader'
import ErrorMessage from './ErrorMessage'
import LoadingIndicator from './LoadingIndicator'
import ProductListPage from '../pages/ProductListPage'
import JarvisTaxesPage from '../pages/JarvisTaxesPage'
import JarvisPaymentMethodsPage from '../pages/JarvisPaymentMethodsPage'
import TercerosPage from '../pages/TercerosPage'
import { getApiErrorMessage } from '../services/apiClient'
import './AdminJarvisCatalog.css'

const views = [
  { id: 'products', label: 'Productos' },
  { id: 'taxes', label: 'Impuestos y retenciones' },
  { id: 'payments', label: 'Formas de pago' },
  { id: 'terceros', label: 'Terceros' },
] as const

type CatalogView = (typeof views)[number]['id']

function hasJarvisIntegration(company: AdminCompanyListItem) {
  return company.integrations.some(
    (item) => item.provider === INTEGRATION_PROVIDER.JARVIS,
  )
}

export default function AdminJarvisCatalog({
  companies,
  loading,
}: {
  companies: AdminCompanyListItem[]
  loading: boolean
}) {
  const { user, switchCompany, isSwitchingCompany } = useAuth()
  const jarvisCompanies = useMemo(
    () => companies.filter(hasJarvisIntegration),
    [companies],
  )
  const [view, setView] = useState<CatalogView>('products')
  const [error, setError] = useState<string | null>(null)
  const autoSwitchId = useRef<string | null>(null)
  const activeCompanyId = user?.company?.id ?? ''
  const selectedId = jarvisCompanies.some((company) => company.id === activeCompanyId)
    ? activeCompanyId
    : (jarvisCompanies[0]?.id ?? '')

  useEffect(() => {
    if (!selectedId || selectedId === activeCompanyId || autoSwitchId.current === selectedId) return
    autoSwitchId.current = selectedId
    setError(null)
    void switchCompany(selectedId).catch((failure: unknown) => {
      setError(
        getApiErrorMessage(
          failure,
          'No se pudo cambiar a esa empresa para ver su catálogo.',
        ),
      )
    })
  }, [selectedId, activeCompanyId, switchCompany])

  const onSelectCompany = (companyId: string) => {
    if (!companyId || companyId === activeCompanyId) return
    setError(null)
    void switchCompany(companyId).catch((failure: unknown) => {
      setError(
        getApiErrorMessage(
          failure,
          'No se pudo cambiar a esa empresa para ver su catálogo.',
        ),
      )
    })
  }

  const catalog =
    view === 'taxes' ? (
      <JarvisTaxesPage />
    ) : view === 'payments' ? (
      <JarvisPaymentMethodsPage />
    ) : view === 'terceros' ? (
      <TercerosPage />
    ) : (
      <ProductListPage />
    )

  return (
    <div className="admin-jarvis-catalog">
      <PageHeader
        eyebrow="Panel interno"
        title="Catálogo de integración Jarvis"
        description="Productos, impuestos, formas de pago y terceros de la empresa Jarvis activa."
        actions={
          jarvisCompanies.length > 0 ? (
            <label className="admin-jarvis-catalog__company">
              Empresa
              <select
                value={selectedId}
                disabled={isSwitchingCompany}
                onChange={(event) => onSelectCompany(event.target.value)}
              >
                {jarvisCompanies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name} · {company.nit}
                  </option>
                ))}
              </select>
            </label>
          ) : null
        }
      />

      {loading ? (
        <LoadingIndicator message="Cargando empresas..." />
      ) : jarvisCompanies.length === 0 ? (
        <p className="admin-empty">
          No hay empresas con integración Jarvis activa. Créela en la sección
          Jarvis para gestionar su catálogo.
        </p>
      ) : (
        <>
          <div
            className="admin-jarvis-catalog__views"
            role="tablist"
            aria-label="Catálogo Jarvis"
          >
            {views.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={view === item.id}
                onClick={() => setView(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          {error && <ErrorMessage message={error} />}
          {isSwitchingCompany ? (
            <LoadingIndicator message="Cambiando de empresa..." />
          ) : (
            <div
              key={`${selectedId}:${view}`}
              className="admin-jarvis-catalog__page"
            >
              {catalog}
            </div>
          )}
        </>
      )}
    </div>
  )
}
