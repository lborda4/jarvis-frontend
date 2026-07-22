import { type FormEvent, useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import ErrorMessage from '../components/ErrorMessage'
import LoadingIndicator from '../components/LoadingIndicator'
import SuccessMessage from '../components/SuccessMessage'
import {
  createAdminCompany,
  fetchAdminCompanies,
  fetchAdminPlans,
} from '../services/adminService'
import { getApiErrorMessage } from '../services/apiClient'
import {
  INTEGRATION_PROVIDER,
  type AdminCompanyListItem,
  type AdminPlan,
  type IntegrationProvider,
} from '../types/admin'
import './AdminPage.css'

function formatIntegrations(company: AdminCompanyListItem): string {
  if (company.integrations.length === 0) {
    return '—'
  }

  return company.integrations
    .map((integration) =>
      integration.provider === INTEGRATION_PROVIDER.SIIGO ? 'SIIGO' : 'Jarvis',
    )
    .join(' · ')
}

function formatPlanLabel(plan: AdminPlan): string {
  if (plan.documentLimit == null) {
    return `${plan.name} (sin límite)`
  }

  return `${plan.name} (${plan.documentLimit} docs)`
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [nit, setNit] = useState('')
  const [name, setName] = useState('')
  const [responsibleName, setResponsibleName] = useState('')
  const [responsiblePhone, setResponsiblePhone] = useState('')
  const [responsibleEmail, setResponsibleEmail] = useState('')
  const [companyPlanId, setCompanyPlanId] = useState('')
  const [selectedIntegrations, setSelectedIntegrations] = useState<
    IntegrationProvider[]
  >([INTEGRATION_PROVIDER.SIIGO])

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

      if (plansResponse.items.length > 0) {
        setCompanyPlanId((current) => current || plansResponse.items[0].id)
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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)
    setIsSubmitting(true)

    try {
      const response = await createAdminCompany({
        nit: nit.trim(),
        name: name.trim(),
        responsible: {
          name: responsibleName.trim(),
          phone: responsiblePhone.trim(),
          email: responsibleEmail.trim(),
        },
        integrations: selectedIntegrations,
        companyPlanId,
      })

      setCompanies((current) => [response.company, ...current])
      setSuccessMessage(`Empresa ${response.company.name} creada correctamente.`)
      setNit('')
      setName('')
      setResponsibleName('')
      setResponsiblePhone('')
      setResponsibleEmail('')
      setSelectedIntegrations([INTEGRATION_PROVIDER.SIIGO])
      setCompanyPlanId(plans[0]?.id ?? '')
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(error, 'No se pudo crear la empresa.'),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="admin-page">
      <header className="admin-page__header">
        <div>
          <p className="admin-page__eyebrow">Panel interno</p>
          <h1>Administración de empresas</h1>
          <p>Gestione empresas, integraciones y planes.</p>
        </div>
        <Link to="/" className="admin-page__back-link">
          Volver a la aplicación
        </Link>
      </header>

      <section className="admin-card">
        <div className="admin-card__header">
          <h2>Crear empresa</h2>
          <p>
            Registre una empresa por NIT, asigne un plan y seleccione las
            integraciones habilitadas.
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
              <label htmlFor="admin-company-plan">Plan</label>
              <select
                id="admin-company-plan"
                value={companyPlanId}
                onChange={(event) => setCompanyPlanId(event.target.value)}
                required
                disabled={isSubmitting || plans.length === 0}
              >
                {plans.length === 0 ? (
                  <option value="">Sin planes disponibles</option>
                ) : (
                  plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {formatPlanLabel(plan)}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

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

          <button
            type="submit"
            className="admin-form__submit"
            disabled={
              isSubmitting ||
              selectedIntegrations.length === 0 ||
              !nit.trim() ||
              !name.trim() ||
              !responsibleName.trim() ||
              !responsiblePhone.trim() ||
              !responsibleEmail.trim() ||
              !companyPlanId
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
                  <th>Persona a cargo</th>
                  <th>Plan</th>
                  <th>Integraciones</th>
                  <th>Creada</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((company) => (
                  <tr key={company.id}>
                    <td>{company.nit}</td>
                    <td>{company.name}</td>
                    <td>{formatResponsible(company.responsible)}</td>
                    <td>
                      {company.companyPlan
                        ? formatPlanLabel(company.companyPlan)
                        : '—'}
                    </td>
                    <td>{formatIntegrations(company)}</td>
                    <td>
                      {new Date(company.createdAt).toLocaleDateString('es-CO')}
                    </td>
                  </tr>
                ))}
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
