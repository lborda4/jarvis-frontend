import { Link, Navigate, useNavigate } from 'react-router-dom'
import { type FormEvent, useState } from 'react'
import ErrorMessage from '../components/ErrorMessage'
import LoadingIndicator from '../components/LoadingIndicator'
import { getAuthErrorMessage, useAuth } from '../context/AuthContext'
import { useBackendWakeup } from '../hooks/useBackendWakeup'
import { parseRegistrationRut } from '../services/authService'
import {
  COMPANY_PERSON_TYPE,
  INTEGRATION_PROVIDER,
  type CompanyPersonType,
  type IntegrationProvider,
  type JarvisCredentialsSeed,
} from '../types/admin'
import { setAuthEntryMode } from '../utils/siigoSetupStorage'
import { toJarvisCredentialsSeed } from '../utils/toJarvisCredentialsSeed'
import '../pages/InvoiceUpload.css'
import './AuthPages.css'

function RegisterPage() {
  const navigate = useNavigate()
  const { register, isAuthenticated, isLoading } = useAuth()
  const { isWaking, isSlow, ensureReady, loadingMessage, error: wakeError } =
    useBackendWakeup()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [companyNit, setCompanyNit] = useState('')
  const [companyPersonType, setCompanyPersonType] = useState<
    CompanyPersonType | ''
  >('')
  const [integrationProvider, setIntegrationProvider] =
    useState<IntegrationProvider>(INTEGRATION_PROVIDER.SIIGO)
  const [responsibleName, setResponsibleName] = useState('')
  const [responsiblePhone, setResponsiblePhone] = useState('')
  const [responsibleEmail, setResponsibleEmail] = useState('')
  const [rutFileName, setRutFileName] = useState('')
  const [rutAddress, setRutAddress] = useState<string | null>(null)
  const [rutWarnings, setRutWarnings] = useState<string[]>([])
  const [jarvisCredentials, setJarvisCredentials] =
    useState<JarvisCredentialsSeed | undefined>()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isParsingRut, setIsParsingRut] = useState(false)
  const [submitIsSlow, setSubmitIsSlow] = useState(false)

  if (!isLoading && isAuthenticated) {
    return <Navigate to="/documento-soporte" replace />
  }

  const handleRutUpload = async (file?: File) => {
    if (!file) return

    setErrorMessage(null)
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
      await ensureReady()
      const response = await parseRegistrationRut(file)
      const rut = response.data

      setCompanyName(rut.name)
      setCompanyNit(rut.nit)
      setCompanyPersonType(rut.personType)
      setResponsibleName(rut.responsibleName ?? '')
      setResponsiblePhone(rut.phone ?? '')
      setResponsibleEmail(rut.email ?? '')
      setName((current) => current.trim() || rut.responsibleName || '')
      setEmail((current) => current.trim() || rut.email || '')
      setRutAddress(rut.address)
      setRutWarnings(rut.warnings)
      setJarvisCredentials(toJarvisCredentialsSeed(rut.jarvisCredentials))
    } catch (error) {
      setRutFileName('')
      setRutAddress(null)
      setJarvisCredentials(undefined)
      setErrorMessage(
        getAuthErrorMessage(
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
    setIsSubmitting(true)
    setSubmitIsSlow(false)

    const slowTimer = window.setTimeout(() => {
      setSubmitIsSlow(true)
    }, 2500)

    try {
      await ensureReady()
      await register({
        name: name.trim(),
        email: email.trim(),
        password,
        company: {
          name: companyName.trim(),
          nit: companyNit.trim(),
          personType: companyPersonType as CompanyPersonType,
          provider: integrationProvider,
          responsible: {
            name: responsibleName.trim(),
            phone: responsiblePhone.trim(),
            email: responsibleEmail.trim(),
          },
          ...(integrationProvider === INTEGRATION_PROVIDER.JARVIS &&
          jarvisCredentials
            ? { jarvisCredentials }
            : {}),
        },
      })
      setAuthEntryMode('register')
      navigate('/documento-soporte', { replace: true })
    } catch (error) {
      setErrorMessage(
        getAuthErrorMessage(error, 'No se pudo completar el registro. Intenta nuevamente.'),
      )
    } finally {
      window.clearTimeout(slowTimer)
      setSubmitIsSlow(false)
      setIsSubmitting(false)
    }
  }

  if (isLoading || isWaking) {
    return (
      <div className="auth-page">
        <LoadingIndicator message={loadingMessage} />
      </div>
    )
  }

  return (
    <main className="auth-page">
      <section className="auth-card auth-card--wide">
        <header className="auth-card__header">
          <p className="auth-card__eyebrow">Nueva cuenta</p>
          <h1>Crear cuenta</h1>
          <p>
            Registra tu usuario y revisa los datos de la empresa antes de
            crearla. Si ya existe el mismo NIT, se vinculará a ella.
          </p>
        </header>

        {wakeError && <ErrorMessage message={wakeError} />}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-form__grid">
            <div className="auth-form__field">
              <label htmlFor="register-name">Nombre</label>
              <input
                id="register-name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="auth-form__field">
              <label htmlFor="register-email">Correo</label>
              <input
                id="register-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="auth-form__field">
              <label htmlFor="register-password">Contraseña</label>
              <input
                id="register-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={6}
                disabled={isSubmitting}
              />
            </div>

            <div className="auth-form__field">
              <label htmlFor="register-integration">Integración</label>
              <select
                id="register-integration"
                value={integrationProvider}
                onChange={(event) =>
                  setIntegrationProvider(
                    event.target.value as IntegrationProvider,
                  )
                }
                required
                disabled={isSubmitting || isParsingRut}
              >
                <option value={INTEGRATION_PROVIDER.SIIGO}>SIIGO</option>
                <option value={INTEGRATION_PROVIDER.JARVIS}>Jarvis</option>
              </select>
            </div>

            {integrationProvider === INTEGRATION_PROVIDER.JARVIS && (
              <div className="auth-form__field auth-form__field--full auth-rut-upload">
                <div>
                  <label htmlFor="register-rut">Autocompletar con el RUT</label>
                  <p>
                    Cargue el PDF de la DIAN; podrá revisar y corregir todos los
                    datos antes de crear la empresa.
                  </p>
                </div>
                <input
                  id="register-rut"
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    void handleRutUpload(file)
                    event.target.value = ''
                  }}
                  disabled={isSubmitting || isParsingRut}
                />
                {isParsingRut && <span>Leyendo RUT...</span>}
                {rutFileName && !isParsingRut && (
                  <span>
                    Datos cargados desde <strong>{rutFileName}</strong>
                  </span>
                )}
                {rutAddress && (
                  <span>
                    Dirección detectada: <strong>{rutAddress}</strong>
                  </span>
                )}
                {rutWarnings.length > 0 && (
                  <ul>
                    {rutWarnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="auth-form__field">
              <label htmlFor="register-company-name">Nombre de la empresa</label>
              <input
                id="register-company-name"
                type="text"
                autoComplete="organization"
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="auth-form__field">
              <label htmlFor="register-company-nit">NIT</label>
              <input
                id="register-company-nit"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={companyNit}
                onChange={(event) => setCompanyNit(event.target.value)}
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="auth-form__field">
              <label htmlFor="register-company-person-type">
                Tipo de persona
              </label>
              <select
                id="register-company-person-type"
                value={companyPersonType}
                onChange={(event) =>
                  setCompanyPersonType(
                    event.target.value as CompanyPersonType | '',
                  )
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

            <div className="auth-form__field">
              <label htmlFor="register-responsible-name">
                Persona a cargo
              </label>
              <input
                id="register-responsible-name"
                type="text"
                value={responsibleName}
                onChange={(event) => setResponsibleName(event.target.value)}
                required
                disabled={isSubmitting || isParsingRut}
              />
            </div>

            <div className="auth-form__field">
              <label htmlFor="register-responsible-phone">
                Teléfono de contacto
              </label>
              <input
                id="register-responsible-phone"
                type="tel"
                value={responsiblePhone}
                onChange={(event) => setResponsiblePhone(event.target.value)}
                required
                disabled={isSubmitting || isParsingRut}
              />
            </div>

            <div className="auth-form__field auth-form__field--full">
              <label htmlFor="register-responsible-email">
                Correo de contacto
              </label>
              <input
                id="register-responsible-email"
                type="email"
                value={responsibleEmail}
                onChange={(event) => setResponsibleEmail(event.target.value)}
                required
                disabled={isSubmitting || isParsingRut}
              />
            </div>
          </div>

          {errorMessage && <ErrorMessage message={errorMessage} />}

          <button
            type="submit"
            className="auth-form__submit"
            disabled={
              isSubmitting ||
              isParsingRut ||
              !companyPersonType ||
              !responsibleName.trim() ||
              !responsiblePhone.trim() ||
              !responsibleEmail.trim()
            }
          >
            {isSubmitting
              ? submitIsSlow || isSlow
                ? 'Estamos iniciando el servicio, espera un momento...'
                : 'Creando cuenta...'
              : 'Registrarse'}
          </button>
        </form>

        <p className="auth-card__footer">
          ¿Ya tienes cuenta? <Link to="/login">Iniciar sesión</Link>
        </p>
      </section>
    </main>
  )
}

export default RegisterPage
