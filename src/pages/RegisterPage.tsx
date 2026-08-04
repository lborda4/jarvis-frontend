import { Link, Navigate, useNavigate } from 'react-router-dom'
import { type FormEvent, useState } from 'react'
import ErrorMessage from '../components/ErrorMessage'
import LoadingIndicator from '../components/LoadingIndicator'
import { getAuthErrorMessage, useAuth } from '../context/AuthContext'
import { useBackendWakeup } from '../hooks/useBackendWakeup'
import { setAuthEntryMode } from '../utils/siigoSetupStorage'
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitIsSlow, setSubmitIsSlow] = useState(false)

  if (!isLoading && isAuthenticated) {
    return <Navigate to="/inicio" replace />
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
        },
      })
      setAuthEntryMode('register')
      navigate('/inicio', { replace: true })
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
            Registra tu usuario por correo. Si la empresa ya existe (mismo NIT),
            se vinculará a ella. Si ya tienes cuenta, usa tu mismo correo y
            contraseña para vincular otra empresa.
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

            <div className="auth-form__field auth-form__field--full">
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
          </div>

          {errorMessage && <ErrorMessage message={errorMessage} />}

          <button
            type="submit"
            className="auth-form__submit"
            disabled={isSubmitting}
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
