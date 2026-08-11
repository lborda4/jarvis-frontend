import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import ErrorMessage from '../components/ErrorMessage'
import LoadingIndicator from '../components/LoadingIndicator'
import PageHeader from '../components/PageHeader'
import SuccessMessage from '../components/SuccessMessage'
import {
  createAdminCompany,
  fetchAdminCompanies,
  fetchAdminPlans,
  parseAdminCompanyRut,
  updateIntegrationSubscription,
} from '../services/adminService'
import { getApiErrorMessage } from '../services/apiClient'
import {
  COMPANY_PERSON_TYPE,
  ELECTRONIC_DOCUMENT_TYPE,
  INTEGRATION_PROVIDER,
  SUBSCRIPTION_STATUS,
  type AdminCompanyListItem,
  type AdminIntegrationItem,
  type AdminPlan,
  type CompanyPersonType,
  type ElectronicDocumentType,
  type IntegrationProvider,
  type JarvisCredentialsSeed,
  type SubscriptionStatus,
} from '../types/admin'
import { toJarvisCredentialsSeed } from '../utils/toJarvisCredentialsSeed'
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

function formatDocumentLimit(limit: number | null | undefined): string {
  if (limit == null) {
    return 'Sin límite'
  }

  return `${limit} docs`
}

function formatPlanName(plan: AdminPlan): string {
  return plan.name
}

function formatProviderLabel(provider: IntegrationProvider): string {
  return provider === INTEGRATION_PROVIDER.SIIGO ? 'SIIGO' : 'Jarvis'
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

function formatIntegrations(company: AdminCompanyListItem): string {
  if (company.integrations.length === 0) {
    return '—'
  }

  return company.integrations
    .map((integration) => formatProviderLabel(integration.provider))
    .join(' · ')
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
  const [companies, setCompanies] = useState<AdminCompanyListItem[]>([])
  const [plans, setPlans] = useState<AdminPlan[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isParsingRut, setIsParsingRut] = useState(false)
  const [updatingIntegrationId, setUpdatingIntegrationId] = useState<
    string | null
  >(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [nit, setNit] = useState('')
  const [name, setName] = useState('')
  const [personType, setPersonType] = useState<CompanyPersonType | ''>('')
  const [responsibleName, setResponsibleName] = useState('')
  const [responsiblePhone, setResponsiblePhone] = useState('')
  const [responsibleEmail, setResponsibleEmail] = useState('')
  const [rutFileName, setRutFileName] = useState('')
  const [rutAddress, setRutAddress] = useState<string | null>(null)
  const [rutWarnings, setRutWarnings] = useState<string[]>([])
  const [jarvisCredentials, setJarvisCredentials] =
    useState<JarvisCredentialsSeed | undefined>()
  const [idSoftware, setIdSoftware] = useState('')
  const [tokenNextPyme, setTokenNextPyme] = useState('')
  const [siigoPlanId, setSiigoPlanId] = useState('')
  const [jarvisPlanId, setJarvisPlanId] = useState('')
  const [selectedDocumentTypes, setSelectedDocumentTypes] = useState<
    ElectronicDocumentType[]
  >([ELECTRONIC_DOCUMENT_TYPE.SUPPORT_DOCUMENT])
  const [selectedIntegrations, setSelectedIntegrations] = useState<
    IntegrationProvider[]
  >([INTEGRATION_PROVIDER.SIIGO])

  const siigoPlans = useMemo(
    () => plans.filter((plan) => plan.provider === INTEGRATION_PROVIDER.SIIGO),
    [plans],
  )
  const jarvisPlans = useMemo(
    () => plans.filter((plan) => plan.provider === INTEGRATION_PROVIDER.JARVIS),
    [plans],
  )

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage(null)

    try {
      const [companiesResponse, plansResponse] = await Promise.all([
        fetchAdminCompanies(),
        fetchAdminPlans(),
      ])

      setCompanies(companiesResponse.items)
      setPlans(plansResponse.items)

      const firstSiigoPlan = plansResponse.items.find(
        (plan) => plan.provider === INTEGRATION_PROVIDER.SIIGO,
      )
      const firstJarvisPlan = plansResponse.items.find(
        (plan) => plan.provider === INTEGRATION_PROVIDER.JARVIS,
      )

      if (firstSiigoPlan) {
        setSiigoPlanId((current) => current || firstSiigoPlan.id)
      }
      if (firstJarvisPlan) {
        setJarvisPlanId((current) => current || firstJarvisPlan.id)
      }
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(error, 'No se pudieron cargar los datos del panel.'),
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const toggleIntegration = (provider: IntegrationProvider) => {
    setSelectedIntegrations((current) => {
      if (current.includes(provider)) {
        return current.filter((item) => item !== provider)
      }

      return [...current, provider]
    })
  }

  const toggleCreateDocumentType = (documentType: ElectronicDocumentType) => {
    setSelectedDocumentTypes((current) => {
      if (current.includes(documentType)) {
        return current.filter((item) => item !== documentType)
      }

      return [...current, documentType]
    })
  }

  const handleRutUpload = async (file?: File) => {
    if (!file) return

    setErrorMessage(null)
    setSuccessMessage(null)
    setRutWarnings([])

    if (
      file.type !== 'application/pdf' &&
      !file.name.toLowerCase().endsWith('.pdf')
    ) {
      setErrorMessage('El RUT debe ser un archivo PDF.')
      return
    }

    setIsParsingRut(true)
    setRutFileName(file.name)

    try {
      const response = await parseAdminCompanyRut(file)
      const rut = response.data

      setNit(rut.nit)
      setName(rut.name)
      setPersonType(rut.personType)
      setResponsibleName(rut.responsibleName ?? '')
      setResponsiblePhone(rut.phone ?? '')
      setResponsibleEmail(rut.email ?? '')
      setRutAddress(rut.address)
      setRutWarnings(rut.warnings)
      setJarvisCredentials(toJarvisCredentialsSeed(rut.jarvisCredentials))
      setSuccessMessage(
        'Datos extraídos del RUT. Revise la información antes de crear la empresa.',
      )
    } catch (error) {
      setRutFileName('')
      setRutAddress(null)
      setJarvisCredentials(undefined)
      setErrorMessage(
        getApiErrorMessage(
          error,
          'No se pudieron extraer los datos del RUT.',
        ),
      )
    } finally {
      setIsParsingRut(false)
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)
    setIsSubmitting(true)

    try {
      const includesSiigo = selectedIntegrations.includes(
        INTEGRATION_PROVIDER.SIIGO,
      )
      const includesJarvis = selectedIntegrations.includes(
        INTEGRATION_PROVIDER.JARVIS,
      )
      const trimmedIdSoftware = idSoftware.trim()
      const trimmedTokenNextPyme = tokenNextPyme.trim()
      const mergedJarvisCredentials: JarvisCredentialsSeed | undefined =
        includesJarvis
          ? {
              ...(jarvisCredentials ?? {}),
              ...(trimmedIdSoftware ? { idSoftware: trimmedIdSoftware } : {}),
              ...(trimmedTokenNextPyme
                ? { tokenNextPyme: trimmedTokenNextPyme }
                : {}),
            }
          : undefined
      const hasJarvisCredentials =
        Boolean(mergedJarvisCredentials) &&
        Object.values(mergedJarvisCredentials ?? {}).some(
          (value) => typeof value === 'string' && value.trim().length > 0,
        )

      const response = await createAdminCompany({
        nit: nit.trim(),
        name: name.trim(),
        personType: personType as CompanyPersonType,
        responsible: {
          name: responsibleName.trim(),
          phone: responsiblePhone.trim(),
          email: responsibleEmail.trim(),
        },
        integrations: selectedIntegrations,
        ...(includesSiigo
          ? {
              siigoPlanId,
            }
          : {}),
        ...(includesJarvis
          ? {
              jarvisPlanId,
            }
          : {}),
        ...((includesSiigo || includesJarvis) && selectedDocumentTypes.length > 0
          ? { includedDocumentTypes: selectedDocumentTypes }
          : {}),
        ...(hasJarvisCredentials
          ? { jarvisCredentials: mergedJarvisCredentials }
          : {}),
      })

      setCompanies((current) => [response.company, ...current])
      setSuccessMessage(`Empresa ${response.company.name} creada correctamente.`)
      setNit('')
      setName('')
      setPersonType('')
      setResponsibleName('')
      setResponsiblePhone('')
      setResponsibleEmail('')
      setRutFileName('')
      setRutAddress(null)
      setRutWarnings([])
      setJarvisCredentials(undefined)
      setIdSoftware('')
      setTokenNextPyme('')
      setSelectedIntegrations([INTEGRATION_PROVIDER.SIIGO])
      setSelectedDocumentTypes([ELECTRONIC_DOCUMENT_TYPE.SUPPORT_DOCUMENT])
      setSiigoPlanId(siigoPlans[0]?.id ?? '')
      setJarvisPlanId(jarvisPlans[0]?.id ?? '')
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(error, 'No se pudo crear la empresa.'),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

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

  const includesSiigo = selectedIntegrations.includes(INTEGRATION_PROVIDER.SIIGO)
  const includesJarvis = selectedIntegrations.includes(
    INTEGRATION_PROVIDER.JARVIS,
  )

  return (
    <main className="admin-page">
      <PageHeader
        eyebrow="Panel interno"
        title="Administración de empresas"
        description="Gestione empresas, integraciones, planes y suscripciones."
        actions={
          <Link to="/inicio" className="admin-page__back-link">
            Volver a la aplicación
          </Link>
        }
      />

      <section className="admin-card">
        <div className="admin-card__header">
          <h2>Crear empresa</h2>
          <p>
            Registre una empresa por NIT, asigne un plan por integración y
            seleccione las integraciones habilitadas.
          </p>
        </div>

        <form className="admin-form" onSubmit={handleSubmit}>
          <div className="admin-form__grid">
            <div className="admin-form__field">
              <label htmlFor="admin-company-nit">NIT</label>
              <input
                id="admin-company-nit"
                type="text"
                inputMode="numeric"
                value={nit}
                onChange={(event) => setNit(event.target.value)}
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="admin-form__field">
              <label htmlFor="admin-company-name">Nombre</label>
              <input
                id="admin-company-name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="admin-form__field">
              <label htmlFor="admin-company-person-type">
                Tipo de persona
              </label>
              <select
                id="admin-company-person-type"
                value={personType}
                onChange={(event) =>
                  setPersonType(event.target.value as CompanyPersonType | '')
                }
                required
                disabled={isSubmitting || isParsingRut}
              >
                <option value="">Seleccione una opción</option>
                <option value={COMPANY_PERSON_TYPE.NATURAL_PERSON}>
                  Persona natural
                </option>
                <option value={COMPANY_PERSON_TYPE.LEGAL_ENTITY}>
                  Persona jurídica
                </option>
              </select>
            </div>

            {includesSiigo && (
              <div className="admin-form__field">
                <label htmlFor="admin-company-plan-siigo">Plan SIIGO</label>
                <select
                  id="admin-company-plan-siigo"
                  value={siigoPlanId}
                  onChange={(event) => setSiigoPlanId(event.target.value)}
                  required
                  disabled={isSubmitting || siigoPlans.length === 0}
                >
                  {siigoPlans.length === 0 ? (
                    <option value="">Sin planes SIIGO disponibles</option>
                  ) : (
                    siigoPlans.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {formatPlanName(plan)} · {formatDocumentLimit(plan.documentLimit)}
                      </option>
                    ))
                  )}
                </select>
              </div>
            )}

            {includesJarvis && (
              <div className="admin-form__field">
                <label htmlFor="admin-company-plan-jarvis">Plan Jarvis</label>
                <select
                  id="admin-company-plan-jarvis"
                  value={jarvisPlanId}
                  onChange={(event) => setJarvisPlanId(event.target.value)}
                  required
                  disabled={isSubmitting || jarvisPlans.length === 0}
                >
                  {jarvisPlans.length === 0 ? (
                    <option value="">Sin planes Jarvis disponibles</option>
                  ) : (
                    jarvisPlans.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {formatPlanName(plan)} · {formatDocumentLimit(plan.documentLimit)}
                      </option>
                    ))
                  )}
                </select>
              </div>
            )}

            {includesJarvis && (
              <>
                <div className="admin-form__field">
                  <label htmlFor="admin-company-id-software">IDSoftware</label>
                  <input
                    id="admin-company-id-software"
                    type="text"
                    value={idSoftware}
                    onChange={(event) => setIdSoftware(event.target.value)}
                    placeholder="Identificador de software NextPyme/DIAN"
                    disabled={isSubmitting}
                    autoComplete="off"
                  />
                </div>

                <div className="admin-form__field">
                  <label htmlFor="admin-company-token-nextpyme">
                    tokenNextPyme
                  </label>
                  <input
                    id="admin-company-token-nextpyme"
                    type="password"
                    value={tokenNextPyme}
                    onChange={(event) => setTokenNextPyme(event.target.value)}
                    placeholder="Token de autenticación NextPyme"
                    disabled={isSubmitting}
                    autoComplete="new-password"
                  />
                </div>
              </>
            )}
          </div>

          {(includesSiigo || includesJarvis) && (
            <fieldset className="admin-form__integrations">
              <legend>Documentos incluidos</legend>
              {AVAILABLE_DOCUMENT_TYPES.map((documentType) => (
                <label
                  key={documentType.value}
                  className="admin-form__checkbox"
                >
                  <input
                    type="checkbox"
                    checked={selectedDocumentTypes.includes(documentType.value)}
                    onChange={() => toggleCreateDocumentType(documentType.value)}
                    disabled={isSubmitting}
                  />
                  {documentType.label}
                </label>
              ))}
            </fieldset>
          )}

          <fieldset className="admin-form__responsible">
            <legend>Persona a cargo</legend>
            <div className="admin-form__grid">
              <div className="admin-form__field">
                <label htmlFor="admin-responsible-name">Nombre</label>
                <input
                  id="admin-responsible-name"
                  type="text"
                  value={responsibleName}
                  onChange={(event) => setResponsibleName(event.target.value)}
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div className="admin-form__field">
                <label htmlFor="admin-responsible-phone">Teléfono</label>
                <input
                  id="admin-responsible-phone"
                  type="tel"
                  inputMode="tel"
                  value={responsiblePhone}
                  onChange={(event) => setResponsiblePhone(event.target.value)}
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div className="admin-form__field">
                <label htmlFor="admin-responsible-email">Correo</label>
                <input
                  id="admin-responsible-email"
                  type="email"
                  autoComplete="email"
                  value={responsibleEmail}
                  onChange={(event) => setResponsibleEmail(event.target.value)}
                  required
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </fieldset>

          <fieldset className="admin-form__integrations">
            <legend>Integraciones</legend>
            <label className="admin-form__checkbox">
              <input
                type="checkbox"
                checked={selectedIntegrations.includes(INTEGRATION_PROVIDER.SIIGO)}
                onChange={() => toggleIntegration(INTEGRATION_PROVIDER.SIIGO)}
                disabled={isSubmitting}
              />
              SIIGO
            </label>
            <label className="admin-form__checkbox">
              <input
                type="checkbox"
                checked={selectedIntegrations.includes(INTEGRATION_PROVIDER.JARVIS)}
                onChange={() => toggleIntegration(INTEGRATION_PROVIDER.JARVIS)}
                disabled={isSubmitting}
              />
              Jarvis
            </label>
          </fieldset>

          {includesJarvis && (
            <section className="admin-rut-upload" aria-labelledby="admin-rut-title">
              <div>
                <h3 id="admin-rut-title">Autocompletar con el RUT</h3>
                <p>
                  Adjunte el PDF de la DIAN. Extraeremos los datos para que los
                  revise antes de crear la empresa.
                </p>
              </div>

              <label className="admin-rut-upload__button">
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    void handleRutUpload(file)
                    event.target.value = ''
                  }}
                  disabled={isSubmitting || isParsingRut}
                />
                {isParsingRut ? 'Leyendo RUT...' : 'Seleccionar RUT (PDF)'}
              </label>

              {rutFileName && (
                <p className="admin-rut-upload__file">
                  Archivo: <strong>{rutFileName}</strong>
                </p>
              )}

              {rutAddress && (
                <p className="admin-rut-upload__detected">
                  Dirección detectada: <strong>{rutAddress}</strong>
                </p>
              )}

              {rutWarnings.length > 0 && (
                <ul className="admin-rut-upload__warnings">
                  {rutWarnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              )}
            </section>
          )}

          <button
            type="submit"
            className="admin-form__submit"
            disabled={
              isSubmitting ||
              selectedIntegrations.length === 0 ||
              !nit.trim() ||
              !name.trim() ||
              !personType ||
              !responsibleName.trim() ||
              !responsiblePhone.trim() ||
              !responsibleEmail.trim() ||
              isParsingRut ||
              (includesSiigo &&
                (!siigoPlanId || selectedDocumentTypes.length === 0)) ||
              (includesJarvis &&
                (!jarvisPlanId || selectedDocumentTypes.length === 0))
            }
          >
            {isSubmitting ? 'Creando empresa...' : 'Crear empresa'}
          </button>
        </form>

        {successMessage && <SuccessMessage message={successMessage} />}
      </section>

      <section className="admin-card">
        <div className="admin-card__header">
          <h2>Empresas vinculadas</h2>
        </div>

        {isLoading ? (
          <LoadingIndicator message="Cargando empresas..." />
        ) : companies.length === 0 ? (
          <p className="admin-empty">No hay empresas vinculadas a su cuenta.</p>
        ) : (
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>NIT</th>
                  <th>Empresa</th>
                  <th>Tipo</th>
                  <th>Persona a cargo</th>
                  <th>Integraciones</th>
                  <th>Plan</th>
                  <th>Documentos</th>
                  <th>Límite</th>
                  <th>Suscripción</th>
                  <th>Creada</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((company) => {
                  const plansByProvider = {
                    [INTEGRATION_PROVIDER.SIIGO]: siigoPlans,
                    [INTEGRATION_PROVIDER.JARVIS]: jarvisPlans,
                  }

                  return (
                    <tr key={company.id}>
                      <td>{company.nit}</td>
                      <td>{company.name}</td>
                      <td>{formatPersonType(company.personType)}</td>
                      <td>{formatResponsible(company.responsible)}</td>
                      <td>{formatIntegrations(company)}</td>
                      <td>
                        {company.integrations.length === 0 ? (
                          '—'
                        ) : (
                          <div className="admin-integration-stack">
                            {company.integrations.map((integration) => {
                              const providerPlans =
                                plansByProvider[integration.provider] ?? []

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
                                        {formatPlanName(plan)}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </td>
                      <td>
                        {company.integrations.length === 0 ? (
                          '—'
                        ) : (
                          <div className="admin-integration-stack">
                            {company.integrations.map((integration) => (
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
                      </td>
                      <td>
                        {company.integrations.length === 0 ? (
                          '—'
                        ) : (
                          <div className="admin-integration-stack">
                            {company.integrations.map((integration) => (
                              <div
                                key={integration.id}
                                className="admin-integration-stack__item"
                              >
                                <span className="admin-integration-stack__label">
                                  {formatProviderLabel(integration.provider)}
                                </span>
                                <span>
                                  {formatDocumentLimit(
                                    integration.plan?.documentLimit,
                                  )}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td>
                        {company.integrations.length === 0 ? (
                          '—'
                        ) : (
                          <div className="admin-integration-stack">
                            {company.integrations.map((integration) => (
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
                      </td>
                      <td>
                        {new Date(company.createdAt).toLocaleDateString('es-CO')}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {errorMessage && <ErrorMessage message={errorMessage} />}
    </main>
  )
}

export default AdminPage
