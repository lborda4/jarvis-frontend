import AdminBoldCashRegisters from './AdminBoldCashRegisters'
import { useEffect, useState, type FormEvent } from 'react'
import Button from './Button'
import ErrorMessage from './ErrorMessage'
import SuccessMessage from './SuccessMessage'
import LoadingIndicator from './LoadingIndicator'
import {
  fetchAdminBoldCredentials,
  saveAdminBoldCredentials,
} from '../services/adminService'
import { getApiErrorMessage } from '../services/apiClient'
import { INTEGRATION_PROVIDER, type AdminCompanyListItem } from '../types/admin'

function BoldCredentialsForm({ company }: { company: AdminCompanyListItem }) {
  const [credentialsVersion, setCredentialsVersion] = useState(0)
  const [identityKey, setIdentityKey] = useState('')
  const [secretKey, setSecretKey] = useState('')
  const [hasSecretKey, setHasSecretKey] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [retry, setRetry] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetchAdminBoldCredentials(company.id)
      .then((response) => {
        if (cancelled) return
        setIdentityKey(response.identityKey)
        setHasSecretKey(response.hasSecretKey)
        setLoaded(true)
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(
            getApiErrorMessage(
              err,
              'No se pudo consultar la configuración de Bold.',
            ),
          )
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [company.id, retry])

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!loaded || saving) return
    setError(null)
    setSuccess(null)
    if (!identityKey.trim() || (!hasSecretKey && !secretKey.trim())) {
      setError('Complete la llave de identidad y la llave secreta.')
      return
    }
    setSaving(true)
    try {
      const response = await saveAdminBoldCredentials(company.id, {
        identityKey: identityKey.trim(),
        ...(secretKey.trim() ? { secretKey: secretKey.trim() } : {}),
      })
      setIdentityKey(response.identityKey)
      setHasSecretKey(response.hasSecretKey)
      setSecretKey('')
      setCredentialsVersion((value) => value + 1)
      setSuccess('Llaves de Bold guardadas para ' + company.name + '.')
    } catch (err) {
      setError(
        getApiErrorMessage(err, 'No se pudieron guardar las llaves de Bold.'),
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {loading && (
        <LoadingIndicator message="Cargando configuración de Bold..." />
      )}
      {loaded && (
        <form className="admin-form" onSubmit={(event) => void save(event)}>
          <div className="admin-form__grid">
            <div className="admin-form__field">
              <label htmlFor="admin-bold-identity-key">
                Llave de identidad
              </label>
              <input
                id="admin-bold-identity-key"
                type="password"
                autoComplete="off"
                value={identityKey}
                maxLength={4096}
                required
                disabled={saving}
                onChange={(event) => {
                  setIdentityKey(event.target.value)
                  setSuccess(null)
                }}
              />
            </div>
            <div className="admin-form__field">
              <label htmlFor="admin-bold-secret-key">Llave secreta</label>
              <input
                id="admin-bold-secret-key"
                type="password"
                autoComplete="new-password"
                value={secretKey}
                maxLength={4096}
                required={!hasSecretKey}
                disabled={saving}
                placeholder={
                  hasSecretKey
                    ? 'Guardada; deje vacío para conservarla'
                    : 'Ingrese la llave secreta'
                }
                onChange={(event) => {
                  setSecretKey(event.target.value)
                  setSuccess(null)
                }}
              />
              {hasSecretKey && (
                <small>
                  Ya hay una llave secreta guardada. Escriba una nueva para
                  reemplazarla.
                </small>
              )}
            </div>
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar llaves'}
          </Button>
        </form>
      )}
      {!loading && !loaded && (
        <Button
          variant="secondary"
          onClick={() => {
            setLoading(true)
            setError(null)
            setRetry((current) => current + 1)
          }}
        >
          Reintentar
        </Button>
      )}
      {error && <ErrorMessage message={error} />}
      {success && <SuccessMessage message={success} />}
      {loaded && (
        <AdminBoldCashRegisters
          key={credentialsVersion}
          companyId={company.id}
          credentialsVersion={credentialsVersion}
        />
      )}
    </>
  )
}

export default function AdminBoldSettings({
  companies,
  loading,
}: {
  companies: AdminCompanyListItem[]
  loading: boolean
}) {
  const [companyId, setCompanyId] = useState('')
  const boldCompanies = companies.filter((company) =>
    company.integrations.some(
      (integration) =>
        integration.provider === INTEGRATION_PROVIDER.BOLD &&
        integration.active,
    ),
  )
  const selected = boldCompanies.find((company) => company.id === companyId)
  return (
    <section className="admin-card">
      <div className="admin-card__header">
        <h2>Configuración de Bold</h2>
        <p>
          Seleccione la empresa para configurar sus llaves, cajas y datáfonos de
          Bold.
        </p>
      </div>
      {loading ? (
        <LoadingIndicator message="Cargando empresas..." />
      ) : boldCompanies.length === 0 ? (
        <p>
          No hay empresas con integración Bold activa. Puede crear una empresa
          con Bold desde la pestaña Jarvis.
        </p>
      ) : (
        <>
          <div className="admin-form__field admin-bold-settings__company">
            <label htmlFor="admin-bold-company">Empresa</label>
            <select
              id="admin-bold-company"
              value={companyId}
              onChange={(event) => setCompanyId(event.target.value)}
            >
              <option value="">Seleccione una empresa</option>
              {boldCompanies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name} · {company.nit}
                </option>
              ))}
            </select>
          </div>
          {selected && (
            <BoldCredentialsForm key={selected.id} company={selected} />
          )}
        </>
      )}
    </section>
  )
}
