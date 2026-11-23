import { cachedQuery, invalidateQueryCache } from '../services/queryCache'
import AdminSidebar from '../components/AdminSidebar'
import AdminPlans from '../components/AdminPlans'
import AdminBoldSettings from '../components/AdminBoldSettings'
import AdminTracking from '../components/AdminTracking'
import AdminAdvisors from '../components/AdminAdvisors'
import { AdminBusinessOverview } from '../components/BusinessDashboard'
import CommissionReport from '../components/CommissionReport'
import Button from '../components/Button'
import { shouldShowTablePagination } from '../utils/tablePagination'
import CompanyAiContextFields from '../components/CompanyAiContextFields'
import CompanyModuleSelect from '../components/CompanyModuleSelect'
import AdminCompanyWelcome from '../components/AdminCompanyWelcome'
import CreateCompanyForm from '../components/CreateCompanyForm'
import { formatAdminPlanOption } from '../utils/adminPlan'
import CompanyJarvisCommercialEditor from '../components/CompanyJarvisCommercialEditor'
import { JARVIS_MODULE_LABELS, companyJarvisModules, type JarvisModule } from '../types/companyModules'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Autocomplete from '../components/Autocomplete'
import { formatMunicipalityLabel } from '../utils/jarvisMunicipality'
import ErrorMessage from '../components/ErrorMessage'
import LoadingIndicator from '../components/LoadingIndicator'
import PageHeader from '../components/PageHeader'
import SuccessMessage from '../components/SuccessMessage'
import { useAuth } from '../context/AuthContext'
import {
  createAdminCompany,
  addAdminCompanyIntegration,
  fetchAdminCities,
  fetchAdminCompanies,
  fetchAdminPlans,
  fetchAdminJarvisTopUps,
  lookupAdminCompanyName,
  updateCompanyCity,
  updateCompanyDescription,
  updateCompanyNextPymeToken,
  updateCompanyIdSoftware,
  updateCompanyJarvisModules,
  updateIntegrationSubscription,
} from '../services/adminService'
import { getApiErrorMessage } from '../services/apiClient'
import {
  COMPANY_PERSON_TYPE,
  ELECTRONIC_DOCUMENT_TYPE,
  INTEGRATION_PROVIDER,
  SUBSCRIPTION_STATUS,
  type AdminCityOption,
  type AdminCompanyListItem,
  type AdminIntegrationItem,
  type AdminPlan,
  type AdminJarvisTopUp,
  type CompanyPersonType,
  type ElectronicDocumentType,
  type IntegrationProvider,
  type SubscriptionStatus,
} from '../types/admin'
import './AdminPage.css'

const AVAILABLE_DOCUMENT_TYPES: Array<{
  value: ElectronicDocumentType
  label: string
}> = [
  {
    value: ELECTRONIC_DOCUMENT_TYPE.SUPPORT_DOCUMENT,
    label: 'Documento soporte',
  },
  {
    value: ELECTRONIC_DOCUMENT_TYPE.PURCHASE_INVOICE,
    label: 'Factura de compra',
  },
]

function formatProviderLabel(provider: IntegrationProvider): string {
  if (provider === INTEGRATION_PROVIDER.SIIGO) return 'SIIGO'
  if (provider === INTEGRATION_PROVIDER.BOLD) return 'Bold'
  return 'Jarvis'
}

function formatPersonType(personType: CompanyPersonType | null): string {
  if (personType === COMPANY_PERSON_TYPE.NATURAL_PERSON) {
    return 'Persona natural'
  }

  if (personType === COMPANY_PERSON_TYPE.LEGAL_ENTITY) {
    return 'Persona jurídica'
  }

  return '—'
}

function formatResponsible(
  responsible: AdminCompanyListItem['responsible'],
): string {
  if (!responsible) {
    return '—'
  }

  return `${responsible.name} · ${responsible.phone} · ${responsible.email}`
}

function AdminPage() {
  const [params, setParams] = useSearchParams()
  const [switchingIntegrationCompanyId, setSwitchingIntegrationCompanyId] = useState<string | null>(null)
  const requestedTab = params.get('tab')
  const activeAdminTab = requestedTab === 'tracking' || requestedTab === 'plans' || requestedTab === 'bold' || requestedTab === 'advisors' || requestedTab === 'jarvis' || requestedTab === 'commissions' ? requestedTab : 'overview'
  const setActiveAdminTab = (tab: string) => setParams({ tab })
  const [creating, setCreating] = useState(false)
  const [companySearch, setCompanySearch] = useState('')
  const [companyPages, setCompanyPages] = useState<Record<string, number>>({})
  const [expandedCompany, setExpandedCompany] = useState<string | null>(null)
  const { logout, refreshUser } = useAuth()
  const [editingModules, setEditingModules] = useState<{ companyId: string; modules: JarvisModule[] } | null>(null)
  const [savingModules, setSavingModules] = useState(false)
  const navigate = useNavigate()
  const [companies, setCompanies] = useState<AdminCompanyListItem[]>([])
  const [plans, setPlans] = useState<AdminPlan[]>([])
  const [topUpCatalog, setTopUpCatalog] = useState<AdminJarvisTopUp[]>([])
  const [cities, setCities] = useState<AdminCityOption[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [dataRevision, setDataRevision] = useState(0)
  useEffect(() => {
    const refresh = () => setDataRevision(value => value + 1)
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [])
  const [updatingIntegrationId, setUpdatingIntegrationId] = useState<
    string | null
  >(null)
  const [editingTokenCompanyId, setEditingTokenCompanyId] = useState<
    string | null
  >(null)
  const [tokenDraft, setTokenDraft] = useState('')
  const [savingTokenCompanyId, setSavingTokenCompanyId] = useState<
    string | null
  >(null)
  const [editingIdSoftwareCompanyId, setEditingIdSoftwareCompanyId] =
    useState<string | null>(null)
  const [idSoftwareDraft, setIdSoftwareDraft] = useState('')
  const [savingIdSoftwareCompanyId, setSavingIdSoftwareCompanyId] =
    useState<string | null>(null)
  const [editingCityCompanyId, setEditingCityCompanyId] = useState<
    string | null
  >(null)
  const [cityDraft, setCityDraft] = useState<AdminCityOption | null>(null)
  const [savingCityCompanyId, setSavingCityCompanyId] = useState<
    string | null
  >(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [editingDescriptionCompanyId, setEditingDescriptionCompanyId] =
    useState<string | null>(null)
  const [descriptionDraft, setDescriptionDraft] = useState('')
  const [aiRulesDraft, setAiRulesDraft] = useState<string[]>([])
  const [savingDescriptionCompanyId, setSavingDescriptionCompanyId] =
    useState<string | null>(null)

  const siigoPlans = useMemo(
    () => plans.filter((plan) => plan.provider === INTEGRATION_PROVIDER.SIIGO),
    [plans],
  )
  const jarvisPlans = useMemo(
    () => plans.filter((plan) => plan.provider === INTEGRATION_PROVIDER.JARVIS),
    [plans],
  )

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setErrorMessage(null)
    const tasks: Promise<unknown>[] = []
    const load = <T,>(key: string, fetcher: () => Promise<T>, apply: (value: T) => void) => {
      tasks.push(cachedQuery('admin:' + key, key === 'cities' ? 24 * 60 * 60_000 : key === 'companies' ? 60_000 : 5 * 60_000, fetcher).then(value => { if (!cancelled) apply(value) }))
    }
    if (['overview', 'tracking', 'jarvis', 'bold', 'advisors'].includes(activeAdminTab)) load('companies', fetchAdminCompanies, value => setCompanies(value.items))
    if (activeAdminTab === 'plans' || (activeAdminTab === 'jarvis' && (creating || expandedCompany))) {
      load('plans', fetchAdminPlans, value => setPlans(value.items))
      load('top-ups', fetchAdminJarvisTopUps, value => setTopUpCatalog(value.items))
    }
    if (activeAdminTab === 'jarvis' && (creating || editingCityCompanyId)) load('cities', fetchAdminCities, value => setCities(value.items))
    void Promise.all(tasks).catch(error => { if (!cancelled) setErrorMessage(getApiErrorMessage(error, 'No se pudieron cargar los datos de esta sección.')) })
      .finally(() => { if (!cancelled) setIsLoading(false) })
    return () => { cancelled = true }
  }, [activeAdminTab, creating, expandedCompany, editingCityCompanyId, dataRevision])

  const applyIntegrationUpdate = (
    companyId: string,
    integrationId: string,
    updatedIntegration: AdminIntegrationItem,
  ) => {
    setCompanies((current) =>
      current.map((item) => {
        if (item.id !== companyId) {
          return item
        }

        return {
          ...item,
          integrations: item.integrations.map((currentIntegration) =>
            currentIntegration.id === integrationId
              ? updatedIntegration
              : currentIntegration,
          ),
        }
      }),
    )
  }

  const handleSubscriptionStatusChange = async (
    company: AdminCompanyListItem,
    integration: AdminIntegrationItem,
    subscriptionStatus: SubscriptionStatus,
  ) => {
    setErrorMessage(null)
    setSuccessMessage(null)
    setUpdatingIntegrationId(integration.id)

    try {
      const response = await updateIntegrationSubscription(
        company.id,
        integration.provider,
        { subscriptionStatus },
      )

      applyIntegrationUpdate(company.id, integration.id, response.integration)
      setSuccessMessage(
        `Suscripción ${formatProviderLabel(integration.provider)} actualizada a ${subscriptionStatus}.`,
      )
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(error, 'No se pudo actualizar la suscripción.'),
      )
    } finally {
      setUpdatingIntegrationId(null)
    }
  }

  const handlePlanChange = async (
    company: AdminCompanyListItem,
    integration: AdminIntegrationItem,
    planId: string,
  ) => {
    if (!planId || planId === integration.plan?.id) {
      return
    }

    setErrorMessage(null)
    setSuccessMessage(null)
    setUpdatingIntegrationId(integration.id)

    try {
      const response = await updateIntegrationSubscription(
        company.id,
        integration.provider,
        { planId },
      )

      applyIntegrationUpdate(company.id, integration.id, response.integration)
      setSuccessMessage(
        `Plan ${formatProviderLabel(integration.provider)} actualizado para ${company.name}.`,
      )
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(error, 'No se pudo actualizar el plan.'),
      )
    } finally {
      setUpdatingIntegrationId(null)
    }
  }

  const handleStartEditToken = (company: AdminCompanyListItem) => {
    setErrorMessage(null)
    setSuccessMessage(null)
    setEditingTokenCompanyId(company.id)
    setTokenDraft(company.nextPymeToken ?? '')
  }

  const handleCancelEditToken = () => {
    setEditingTokenCompanyId(null)
    setTokenDraft('')
  }

  const handleSaveToken = async (company: AdminCompanyListItem) => {
    setErrorMessage(null)
    setSuccessMessage(null)
    setSavingTokenCompanyId(company.id)

    try {
      const response = await updateCompanyNextPymeToken(company.id, {
        nextPymeToken: tokenDraft.trim() || null,
      })

      setCompanies((current) =>
        current.map((item) =>
          item.id === company.id
            ? { ...item, nextPymeToken: response.company.nextPymeToken }
            : item,
        ),
      )
      setSuccessMessage(`Token de NextPyme actualizado para ${company.name}.`)
      setEditingTokenCompanyId(null)
      setTokenDraft('')
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(error, 'No se pudo actualizar el token de NextPyme.'),
      )
    } finally {
      setSavingTokenCompanyId(null)
    }
  }

  const handleStartEditIdSoftware = (company: AdminCompanyListItem) => {
    setErrorMessage(null)
    setSuccessMessage(null)
    setEditingIdSoftwareCompanyId(company.id)
    setIdSoftwareDraft(company.idSoftware ?? '')
  }

  const handleCancelEditIdSoftware = () => {
    setEditingIdSoftwareCompanyId(null)
    setIdSoftwareDraft('')
  }

  const handleSaveIdSoftware = async (company: AdminCompanyListItem) => {
    setErrorMessage(null)
    setSuccessMessage(null)
    setSavingIdSoftwareCompanyId(company.id)

    try {
      const response = await updateCompanyIdSoftware(company.id, {
        idSoftware: idSoftwareDraft.trim() || null,
      })

      setCompanies((current) =>
        current.map((item) =>
          item.id === company.id
            ? { ...item, idSoftware: response.company.idSoftware }
            : item,
        ),
      )
      setSuccessMessage(`Clave técnica actualizada para ${company.name}.`)
      setEditingIdSoftwareCompanyId(null)
      setIdSoftwareDraft('')
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(error, 'No se pudo actualizar la clave técnica.'),
      )
    } finally {
      setSavingIdSoftwareCompanyId(null)
    }
  }

  const handleStartEditDescription = (company: AdminCompanyListItem) => {
    setErrorMessage(null)
    setSuccessMessage(null)
    setEditingDescriptionCompanyId(company.id)
    setDescriptionDraft(company.description ?? '')
    setAiRulesDraft(company.aiRules ?? [])
  }

  const handleCancelEditDescription = () => {
    setEditingDescriptionCompanyId(null)
    setDescriptionDraft('')
  }

  const handleSaveDescription = async (company: AdminCompanyListItem) => {
    if (aiRulesDraft.some((rule) => !rule.trim())) {
      setErrorMessage('Complete o elimine las reglas vacías.')
      return
    }
    setErrorMessage(null)
    setSuccessMessage(null)
    setSavingDescriptionCompanyId(company.id)

    try {
      const response = await updateCompanyDescription(company.id, {
        description: descriptionDraft.trim() || null,
        aiRules: aiRulesDraft.map((rule) => rule.trim()),
      })

      setCompanies((current) =>
        current.map((item) =>
          item.id === company.id
            ? { ...item, description: response.company.description, aiRules: response.company.aiRules }
            : item,
        ),
      )
      setSuccessMessage(`Descripción y reglas actualizadas para ${company.name}.`)
      setEditingDescriptionCompanyId(null)
      setDescriptionDraft('')
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(error, 'No se pudo actualizar la descripción.'),
      )
    } finally {
      setSavingDescriptionCompanyId(null)
    }
  }

  const handleStartEditCity = (company: AdminCompanyListItem) => {
    setErrorMessage(null)
    setSuccessMessage(null)
    setEditingCityCompanyId(company.id)
    setCityDraft(
      company.cityCode
        ? { code: company.cityCode, name: company.cityName ?? cities.find(city => city.code === company.cityCode)?.name ?? 'Ciudad sin nombre' }
        : null,
    )
  }

  const handleCancelEditCity = () => {
    setEditingCityCompanyId(null)
    setCityDraft(null)
  }

  const handleSaveCity = async (company: AdminCompanyListItem) => {
    setErrorMessage(null)
    setSuccessMessage(null)
    setSavingCityCompanyId(company.id)

    try {
      const response = await updateCompanyCity(company.id, {
        cityCode: cityDraft?.code ?? null,
        cityName: cityDraft?.name ?? null,
      })

      setCompanies((current) =>
        current.map((item) =>
          item.id === company.id
            ? {
                ...item,
                cityCode: response.company.cityCode,
                cityName: response.company.cityName,
              }
            : item,
        ),
      )
      setSuccessMessage(`Ciudad actualizada para ${company.name}.`)
      setEditingCityCompanyId(null)
      setCityDraft(null)
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(error, 'No se pudo actualizar la ciudad.'),
      )
    } finally {
      setSavingCityCompanyId(null)
    }
  }

  const handleDocumentTypesChange = async (
    company: AdminCompanyListItem,
    integration: AdminIntegrationItem,
    documentType: ElectronicDocumentType,
    checked: boolean,
  ) => {
    const currentTypes = integration.includedDocumentTypes ?? []
    const nextTypes = checked
      ? [...new Set([...currentTypes, documentType])]
      : currentTypes.filter((type) => type !== documentType)

    if (nextTypes.length === 0) {
      setErrorMessage('Debe dejar al menos un tipo de documento habilitado.')
      return
    }

    const unchanged =
      nextTypes.length === currentTypes.length &&
      nextTypes.every((type) => currentTypes.includes(type))

    if (unchanged) {
      return
    }

    setErrorMessage(null)
    setSuccessMessage(null)
    setUpdatingIntegrationId(integration.id)

    try {
      const response = await updateIntegrationSubscription(
        company.id,
        integration.provider,
        { includedDocumentTypes: nextTypes },
      )

      applyIntegrationUpdate(company.id, integration.id, response.integration)
      setSuccessMessage(
        `Documentos actualizados para ${company.name}.`,
      )
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(error, 'No se pudieron actualizar los documentos.'),
      )
    } finally {
      setUpdatingIntegrationId(null)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const openCreate = () => { setCreating(true); setActiveAdminTab('jarvis') }
  const titles: Record<string, string> = { overview: 'Resumen del negocio', tracking: 'Clientes', jarvis: creating ? 'Crear empresa' : 'Empresas e integraciones', advisors: 'Asesores', commissions: 'Pagos y comisiones', plans: 'Planes y recargas', bold: 'Integración Bold' }

  return (
    <div className="admin-shell">
      <AdminSidebar active={activeAdminTab} onChange={setActiveAdminTab} onLogout={handleLogout} />
    <main className={`admin-page${activeAdminTab === 'tracking' ? ' admin-page--tracking' : ''}`}>
      <PageHeader
        eyebrow="Panel interno"
        title={titles[activeAdminTab]}
        actions={<Button variant="outline" disabled={isLoading} onClick={() => { invalidateQueryCache('admin'); setIsLoading(true); setErrorMessage(null); setDataRevision(value => value + 1) }}>Actualizar</Button>}
      />
      {successMessage && <SuccessMessage message={successMessage} />}
      {errorMessage && <ErrorMessage message={errorMessage} />}
      <div id="admin-panel-overview" role="tabpanel" aria-labelledby="admin-tab-overview" hidden={activeAdminTab !== 'overview'}>
        {activeAdminTab === 'overview' && (isLoading ? <LoadingIndicator message="Cargando resumen…" /> : <AdminBusinessOverview companies={companies} onClients={status => setParams(status ? { tab: 'tracking', status } : { tab: 'tracking' })} onCreate={openCreate} onAdvisors={() => setActiveAdminTab('advisors')} onCommissions={() => setActiveAdminTab('commissions')} />)}
      </div>
      <div id="admin-panel-commissions" role="tabpanel" aria-labelledby="admin-tab-commissions" hidden={activeAdminTab !== 'commissions'}>
        {activeAdminTab === 'commissions' && <CommissionReport admin />}
      </div>

      <div id="admin-panel-advisors" role="tabpanel" aria-labelledby="admin-tab-advisors" hidden={activeAdminTab !== 'advisors'}>
        {activeAdminTab === 'advisors' && <AdminAdvisors companies={companies} onCompanyAssigned={(companyId, advisorId, name) => setCompanies(current => current.map(company => company.id === companyId ? { ...company, advisorId, commercial: name } : company))} />}
      </div>
      <div id="admin-panel-plans" role="tabpanel" aria-labelledby="admin-tab-plans" hidden={activeAdminTab !== 'plans'}>
        {activeAdminTab === 'plans' && <AdminPlans plans={plans} topUps={topUpCatalog} loading={isLoading} onUpdated={plan => {
          setPlans(current => current.map(item => item.id === plan.id ? plan : item))
          setCompanies(current => current.map(company => ({ ...company, integrations: company.integrations.map(integration => integration.plan?.id === plan.id ? { ...integration, plan } : integration) })))
        }} />}
      </div>
      <div id="admin-panel-bold" role="tabpanel" aria-labelledby="admin-tab-bold" hidden={activeAdminTab !== 'bold'}>
        {activeAdminTab === 'bold' && <AdminBoldSettings companies={companies} loading={isLoading} />}
      </div>
      <div id="admin-panel-tracking" role="tabpanel" aria-labelledby="admin-tab-tracking" hidden={activeAdminTab !== 'tracking'}>
        {activeAdminTab === 'tracking' && <AdminTracking key={params.get('status') ?? 'all'} initialStatus={params.get('status') ?? ''} companies={companies} loading={isLoading}
          onUpdated={company => setCompanies(current => current.map(item => item.id === company.id ? company : item))}
          onCreate={openCreate} />}
      </div>
      <div id="admin-panel-jarvis" role="tabpanel" aria-labelledby="admin-tab-jarvis" hidden={activeAdminTab !== 'jarvis'}>
      <div className="business-section-heading"><h2>{creating ? 'Nueva empresa' : 'Directorio de empresas'}</h2><Button variant={creating ? 'outline' : 'primary'} disabled={isLoading} onClick={() => setCreating(value => !value)}>{creating ? 'Volver al directorio' : '+ Crear empresa'}</Button></div>
{!isLoading && creating && <CreateCompanyForm plans={plans} cities={cities} topUpCatalog={topUpCatalog} onCancel={() => setCreating(false)} createCompany={createAdminCompany} lookupName={lookupAdminCompanyName} onCreated={response => { setCompanies(current => [response.company, ...current]); setCreating(false); setSuccessMessage(`Empresa ${response.company.name} creada.`); if (response.welcome?.status === 'FAILED') setErrorMessage(response.welcome.message) }} />}
      {!creating && <div className="business-filters"><label className="admin-form__field">Buscar empresa<input type="search" placeholder="Nombre, NIT, correo o asesor" value={companySearch} onChange={event => { setCompanySearch(event.target.value); setCompanyPages({}) }} /></label></div>}

      {!creating && [INTEGRATION_PROVIDER.SIIGO, INTEGRATION_PROVIDER.JARVIS].map(provider => {
        const rows = companies.filter(company => company.integrations.some(item => item.provider === provider) && `${company.name} ${company.nit} ${company.email ?? ''} ${company.responsible?.email ?? ''} ${company.commercial ?? ''}`.toLocaleLowerCase('es').includes(companySearch.trim().toLocaleLowerCase('es')));
        const pages = Math.max(1, Math.ceil(rows.length / 10));
        const page = Math.min(companyPages[provider] ?? 1, pages);
        const columns = provider === INTEGRATION_PROVIDER.SIIGO
          ? [0, 1, 2, 14, 3, 6, 7, 8, 11, 13]
          : [0, 1, 2, 14, 6, 7, 11, 12];
        const headings = ['Acceso de usuario', 'NIT', 'Empresa', 'Descripción', 'Tipo', 'Persona a cargo', 'Integración', 'Plan', 'Documentos', 'Suscripción', 'Creada', 'Token NextPyme', 'IDSoftware', 'Ciudad', 'Correo'];
        return <section className="admin-card" key={provider}>
          <div className="admin-card__header"><h2>Empresas con integración {formatProviderLabel(provider)}</h2></div>
          {isLoading ? <LoadingIndicator message="Cargando empresas..." /> : rows.length === 0 ? <p className="admin-empty">No hay empresas con esta integración.</p> :
            <div className="admin-table-wrapper"><table className="admin-table admin-directory">
              <thead><tr><th>Empresa / NIT</th><th>Contacto</th><th>Plan</th><th>Gestión</th></tr></thead>
              <tbody>{rows.slice((page - 1) * 10, page * 10).map(company => {
                const plansByProvider: Partial<Record<IntegrationProvider, AdminPlan[]>> = {
                  [INTEGRATION_PROVIDER.SIIGO]: siigoPlans, [INTEGRATION_PROVIDER.JARVIS]: jarvisPlans,
                };
                const cells = [
                  <td>
                        <AdminCompanyWelcome company={company} onSent={email => setCompanies(current => current.map(item => item.id === company.id ? { ...item, registrationEmail: email } : item))} />
                      </td>,
                  <td>{company.nit}</td>,
                  <td><button type="button" className="admin-page__client-link" onClick={() => navigate(`/admin/clientes/${encodeURIComponent(company.id)}`)}>{company.name}</button></td>,
                  <td>
                        {editingDescriptionCompanyId === company.id ? (
                          <div className="admin-nextpyme-token admin-nextpyme-token--editing">
                            <CompanyAiContextFields
                              value={{ description: descriptionDraft, rules: aiRulesDraft }}
                              onChange={(context) => {
                                setDescriptionDraft(context.description)
                                setAiRulesDraft(context.rules)
                              }}
                              disabled={savingDescriptionCompanyId === company.id}
                            />
                            <div className="admin-nextpyme-token__actions">
                              <button
                                type="button"
                                disabled={
                                  savingDescriptionCompanyId === company.id
                                }
                                onClick={() =>
                                  void handleSaveDescription(company)
                                }
                              >
                                {savingDescriptionCompanyId === company.id
                                  ? 'Guardando...'
                                  : 'Guardar'}
                              </button>
                              <button
                                type="button"
                                disabled={
                                  savingDescriptionCompanyId === company.id
                                }
                                onClick={handleCancelEditDescription}
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="admin-nextpyme-token">
                            <span
                              className="admin-nextpyme-token__value"
                              title={company.description ?? undefined}
                            >
                              {company.description?.trim() || 'Sin descripción'}
                              {Boolean(company.aiRules?.length) && <small> · {company.aiRules?.length} regla(s)</small>}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                handleStartEditDescription(company)
                              }
                            >
                              {company.description ? 'Editar' : 'Configurar'}
                            </button>
                          </div>
                        )}
                    </td>,
                  <td>{formatPersonType(company.personType)}</td>,
                  <td>{formatResponsible(company.responsible)}</td>,
                  <td>
                      <div className="admin-integration-stack">
                        {company.integrations.map(integration => <span key={integration.id}>{formatProviderLabel(integration.provider)}</span>)}
                        {company.integrations.some(integration => integration.provider === INTEGRATION_PROVIDER.JARVIS) && (
                          editingModules?.companyId === company.id ? <div>
                            <CompanyModuleSelect value={editingModules.modules} disabled={savingModules} onChange={modules => setEditingModules({ companyId: company.id, modules })} />
                            <button type="button" disabled={savingModules || !editingModules.modules.length} onClick={async () => {
                              setSavingModules(true); setErrorMessage(null)
                              try {
                                const response = await updateCompanyJarvisModules(company.id, editingModules.modules)
                                setCompanies(current => current.map(item => item.id === company.id ? response.company : item))
                                setEditingModules(null)
                                setSuccessMessage(`Módulos de ${company.name} actualizados.`)
                                void refreshUser().catch(() => undefined)
                              } catch (error) {
                                setErrorMessage(getApiErrorMessage(error, 'No se pudieron actualizar los módulos.'))
                              } finally { setSavingModules(false) }
                            }}>{savingModules ? 'Guardando…' : 'Guardar módulos'}</button>
                            <button type="button" disabled={savingModules} onClick={() => setEditingModules(null)}>Cancelar</button>
                          </div> : <div>
                            <span>{companyJarvisModules(company.jarvisModules).map(module => JARVIS_MODULE_LABELS[module]).join(' · ')}</span>
                            <button type="button" disabled={savingModules} onClick={() => setEditingModules({ companyId: company.id, modules: [...companyJarvisModules(company.jarvisModules)] })}>Editar módulos</button>
                          </div>
                        )}
                      </div>
                      <select
                        aria-label={`Agregar integración a ${company.name}`}
                        value=""
                        disabled={switchingIntegrationCompanyId !== null || Object.values(INTEGRATION_PROVIDER).every(provider => company.integrations.some(item => item.provider === provider))}
                        onChange={async event => {
                          const provider = event.target.value as IntegrationProvider
                          setSwitchingIntegrationCompanyId(company.id)
                          setErrorMessage(null)
                          try {
                            const response = await addAdminCompanyIntegration(company.id, provider)
                            setCompanies(current => current.map(item => item.id === company.id ? response.company : item))
                            setSuccessMessage(`Integración ${formatProviderLabel(provider)} agregada a ${company.name}.`)
                          } catch (error) {
                            setErrorMessage(getApiErrorMessage(error, 'No se pudo agregar la integración.'))
                          } finally {
                            setSwitchingIntegrationCompanyId(null)
                          }
                        }}
                      >
                        <option value="" disabled>{switchingIntegrationCompanyId === company.id ? 'Agregando...' : 'Agregar integración'}</option>
                        {Object.values(INTEGRATION_PROVIDER).filter(provider => !company.integrations.some(item => item.provider === provider)).map(provider => <option key={provider} value={provider}>{formatProviderLabel(provider)}</option>)}
                      </select>
                    </td>,
                  <td>
                        {company.integrations.length === 0 ? (
                          '—'
                        ) : (
                          <div className="admin-integration-stack">
                            {company.integrations.filter(item => item.provider === provider).map((integration) => {
                              const providerPlans =
                                plansByProvider[integration.provider] ?? []

                              if (integration.provider === INTEGRATION_PROVIDER.JARVIS) return <CompanyJarvisCommercialEditor key={integration.id}
                                company={company} integration={integration} plans={providerPlans} catalog={topUpCatalog}
                                onSaved={(updated, message) => {
                                  setCompanies(current => current.map(item => item.id === updated.id ? updated : item))
                                  setSuccessMessage(message ?? `Cambios guardados para ${updated.name}.`)
                                  void refreshUser().catch(() => undefined)
                                }} />

                              return (
                                <div
                                  key={integration.id}
                                  className="admin-integration-stack__item"
                                >
                                  <span className="admin-integration-stack__label">
                                    {formatProviderLabel(integration.provider)}
                                  </span>
                                  <select
                                    className="admin-plan-select"
                                    aria-label={`Plan ${formatProviderLabel(integration.provider)} de ${company.name}`}
                                    value={integration.plan?.id ?? ''}
                                    disabled={
                                      updatingIntegrationId ===
                                        integration.id ||
                                      providerPlans.length === 0
                                    }
                                    onChange={(event) =>
                                      void handlePlanChange(
                                        company,
                                        integration,
                                        event.target.value,
                                      )
                                    }
                                  >
                                    {!integration.plan && (
                                      <option value="">Seleccione un plan</option>
                                    )}
                                    {providerPlans.map((plan) => (
                                      <option key={plan.id} value={plan.id}>
                                        {formatAdminPlanOption(plan)}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              )
                            })}
                          </div>
                        )}
                    </td>,
                  <td>
                        {company.integrations.length === 0 ? (
                          '—'
                        ) : (
                          <div className="admin-integration-stack">
                            {company.integrations.filter(item => item.provider === provider).map((integration) => (
                              <div
                                key={integration.id}
                                className="admin-integration-stack__item"
                              >
                                <span className="admin-integration-stack__label">
                                  {formatProviderLabel(integration.provider)}
                                </span>
                                <div className="admin-document-types">
                                  {AVAILABLE_DOCUMENT_TYPES.map(
                                    (documentType) => {
                                      const checked = (
                                        integration.includedDocumentTypes ?? []
                                      ).includes(documentType.value)

                                      return (
                                        <label
                                          key={documentType.value}
                                          className="admin-form__checkbox"
                                        >
                                          <input
                                            type="checkbox"
                                            checked={checked}
                                            disabled={
                                              updatingIntegrationId ===
                                              integration.id
                                            }
                                            onChange={(event) =>
                                              void handleDocumentTypesChange(
                                                company,
                                                integration,
                                                documentType.value,
                                                event.target.checked,
                                              )
                                            }
                                          />
                                          {documentType.label}
                                        </label>
                                      )
                                    },
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>,
                  <td>
                        {company.integrations.length === 0 ? (
                          '—'
                        ) : (
                          <div className="admin-integration-stack">
                            {company.integrations.filter(item => item.provider === provider).map((integration) => (
                              <div
                                key={integration.id}
                                className="admin-integration-stack__item"
                              >
                                <span className="admin-integration-stack__label">
                                  {formatProviderLabel(integration.provider)}
                                </span>
                                <div className="admin-subscription-actions">
                                  <span className="admin-subscription-status">
                                    {integration.subscriptionStatus ??
                                      'sin estado'}
                                    {integration.subscriptionStartedAt
                                      ? ` · desde ${new Date(
                                          integration.subscriptionStartedAt,
                                        ).toLocaleDateString('es-CO')}`
                                      : ''}
                                  </span>
                                  <div>
                                    <button
                                      type="button"
                                      disabled={
                                        updatingIntegrationId ===
                                          integration.id ||
                                        integration.subscriptionStatus ===
                                          SUBSCRIPTION_STATUS.ACTIVE
                                      }
                                      onClick={() =>
                                        void handleSubscriptionStatusChange(
                                          company,
                                          integration,
                                          SUBSCRIPTION_STATUS.ACTIVE,
                                        )
                                      }
                                    >
                                      Activar
                                    </button>
                                    <button
                                      type="button"
                                      disabled={
                                        updatingIntegrationId ===
                                          integration.id ||
                                        integration.subscriptionStatus ===
                                          SUBSCRIPTION_STATUS.SUSPENDED
                                      }
                                      onClick={() =>
                                        void handleSubscriptionStatusChange(
                                          company,
                                          integration,
                                          SUBSCRIPTION_STATUS.SUSPENDED,
                                        )
                                      }
                                    >
                                      Suspender
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>,
                  <td>
                      {new Date(company.createdAt).toLocaleDateString('es-CO')}
                    </td>,
                  <td>
                        {editingTokenCompanyId === company.id ? (
                          <div className="admin-nextpyme-token admin-nextpyme-token--editing">
                            <input
                              type="text"
                              value={tokenDraft}
                              onChange={(event) =>
                                setTokenDraft(event.target.value)
                              }
                              placeholder="Token Bearer de NextPyme"
                              disabled={savingTokenCompanyId === company.id}
                              autoFocus
                            />
                            <div className="admin-nextpyme-token__actions">
                              <button
                                type="button"
                                disabled={savingTokenCompanyId === company.id}
                                onClick={() => void handleSaveToken(company)}
                              >
                                {savingTokenCompanyId === company.id
                                  ? 'Guardando...'
                                  : 'Guardar'}
                              </button>
                              <button
                                type="button"
                                disabled={savingTokenCompanyId === company.id}
                                onClick={handleCancelEditToken}
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="admin-nextpyme-token">
                            <span className="admin-nextpyme-token__value">
                              {company.nextPymeToken
                                ? `•••• ${company.nextPymeToken.slice(-4)}`
                                : 'Usa el token global'}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleStartEditToken(company)}
                            >
                              {company.nextPymeToken ? 'Editar' : 'Configurar'}
                            </button>
                          </div>
                        )}
                      </td>,
                  <td>
                        {editingIdSoftwareCompanyId === company.id ? (
                          <div className="admin-nextpyme-token admin-nextpyme-token--editing">
                            <input
                              type="text"
                              value={idSoftwareDraft}
                              onChange={(event) =>
                                setIdSoftwareDraft(event.target.value)
                              }
                              placeholder="Clave técnica DIAN"
                              disabled={
                                savingIdSoftwareCompanyId === company.id
                              }
                              autoComplete="off"
                            />
                            <div className="admin-nextpyme-token__actions">
                              <button
                                type="button"
                                disabled={
                                  savingIdSoftwareCompanyId === company.id
                                }
                                onClick={() =>
                                  void handleSaveIdSoftware(company)
                                }
                              >
                                {savingIdSoftwareCompanyId === company.id
                                  ? 'Guardando...'
                                  : 'Guardar'}
                              </button>
                              <button
                                type="button"
                                disabled={
                                  savingIdSoftwareCompanyId === company.id
                                }
                                onClick={handleCancelEditIdSoftware}
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="admin-nextpyme-token">
                            <span className="admin-nextpyme-token__value">
                              {company.idSoftware
                                ? `•••• ${company.idSoftware.slice(-4)}`
                                : 'Sin IDSoftware'}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                handleStartEditIdSoftware(company)
                              }
                            >
                              {company.idSoftware ? 'Editar' : 'Configurar'}
                            </button>
                          </div>
                        )}
                      </td>,
                  <td>
                        {editingCityCompanyId === company.id ? (
                          <div className="admin-nextpyme-token admin-nextpyme-token--editing">
                            <Autocomplete<AdminCityOption>
                              value={cityDraft}
                              onChange={setCityDraft}
                              options={cities}
                              disabled={savingCityCompanyId === company.id}
                              placeholder="Buscar ciudad..."
                              emptyMessage="No se encontraron ciudades"
                              getOptionKey={(city) => city.code}
                              getOptionLabel={formatMunicipalityLabel}
                            />
                            <div className="admin-nextpyme-token__actions">
                              <button
                                type="button"
                                disabled={savingCityCompanyId === company.id}
                                onClick={() => void handleSaveCity(company)}
                              >
                                {savingCityCompanyId === company.id
                                  ? 'Guardando...'
                                  : 'Guardar'}
                              </button>
                              <button
                                type="button"
                                disabled={savingCityCompanyId === company.id}
                                onClick={handleCancelEditCity}
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="admin-nextpyme-token">
                            <span className="admin-nextpyme-token__value">
                              {company.cityName ?? 'Sin ciudad (usa Bogotá)'}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleStartEditCity(company)}
                            >
                              {company.cityCode ? 'Editar' : 'Configurar'}
                            </button>
                          </div>
                        )}
                      </td>,
                  <td>{company.email?.trim() || 'Sin correo'}</td>
                ];
                const detailId = `company-config-${provider}-${company.id}`;
                const expanded = expandedCompany === detailId;
                return <Fragment key={company.id}><tr>
                  <td data-label="Empresa">{cells[2].props.children}<small>NIT {company.nit}</small></td>
                  <td data-label="Contacto">{company.responsible?.name || 'Sin contacto'}<small>{company.responsible?.email ?? company.email ?? company.registrationEmail ?? 'Sin correo'}</small></td>
                  <td data-label="Plan">{company.integrations.find(item => item.provider === provider)?.plan?.name ?? 'Sin plan'}<small>{formatProviderLabel(provider)}</small></td>
                  <td data-label="Gestión"><Button variant="outline" size="sm" aria-expanded={expanded} aria-controls={detailId} onClick={() => setExpandedCompany(expanded ? null : detailId)}>{expanded ? 'Cerrar' : 'Configurar'}</Button></td>
                </tr>{expanded && <tr className="admin-directory__details"><td colSpan={4}><div id={detailId} className="admin-company-config">{columns.filter(index => ![1, 2].includes(index)).map(index => <section key={index}><h3>{headings[index]}</h3>{cells[index].props.children}</section>)}</div></td></tr>}</Fragment>;
              })}</tbody>
            </table></div>}
          {shouldShowTablePagination(rows.length) && <div className="business-actions admin-directory-pages"><span>{rows.length} empresas · {page} / {pages}</span><Button variant="outline" disabled={page === 1} onClick={() => setCompanyPages(current => ({ ...current, [provider]: page - 1 }))}>Anterior</Button><Button variant="outline" disabled={page === pages} onClick={() => setCompanyPages(current => ({ ...current, [provider]: page + 1 }))}>Siguiente</Button></div>}
        </section>;
      })}

      </div>
    </main>
    </div>
  )
}

export default AdminPage
