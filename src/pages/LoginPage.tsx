import { Link, Navigate, useNavigate } from 'react-router-dom'
import { type FormEvent, useState } from 'react'
import ErrorMessage from '../components/ErrorMessage'
import LoadingIndicator from '../components/LoadingIndicator'
import { useAuth } from '../context/AuthContext'
import { isAdminRole } from '../constants/userRole'
import { setAuthEntryMode } from '../utils/siigoSetupStorage'
import {
  resolveLoginError,
  type LoginErrorKind,
} from '../utils/resolveLoginError'
import '../pages/InvoiceUpload.css'
import './AuthPages.css'

const DEFAULT_APP_PATH = '/inicio'
const ADMIN_APP_PATH = '/admin'

function resolvePostLoginPath(role?: string): string {
  return isAdminRole(role) ? ADMIN_APP_PATH : DEFAULT_APP_PATH
}

function LoginPage() {
  const navigate = useNavigate()
  const { login, isAuthenticated, isLoading, user } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [errorKind, setErrorKind] = useState<LoginErrorKind | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const redirectPath = resolvePostLoginPath(user?.role)

  if (!isLoading && isAuthenticated) {
    return <Navigate to={redirectPath} replace />
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    setErrorKind(null)
    setIsSubmitting(true)

    try {
      const loggedInUser = await login({
        email: email.trim(),
        password,
      })
      setAuthEntryMode('login')
      navigate(resolvePostLoginPath(loggedInUser.role), { replace: true })
    } catch (error) {
      const resolved = resolveLoginError(
        error,
        'No se pudo iniciar sesión. Intenta nuevamente.',
      )
      setErrorMessage(resolved.message)
      setErrorKind(resolved.kind)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="auth-loading-screen">
        <LoadingIndicator message="Cargando..." />
      </div>
    )
  }

  return (
    <main className="auth-page auth-page--login">
      <div className="auth-login-backdrop" aria-hidden="true">
        <span className="auth-login-backdrop__vignette" />
        <span className="auth-login-backdrop__grid" />
        <span className="auth-login-backdrop__scanlines" />
        <span className="auth-login-backdrop__ring auth-login-backdrop__ring--outer" />
        <span className="auth-login-backdrop__ring auth-login-backdrop__ring--inner" />
        <span className="auth-login-backdrop__triangle" />
        <span className="auth-login-backdrop__orb auth-login-backdrop__orb--one" />
        <span className="auth-login-backdrop__orb auth-login-backdrop__orb--two" />
        <span className="auth-login-backdrop__corner auth-login-backdrop__corner--tl" />
        <span className="auth-login-backdrop__corner auth-login-backdrop__corner--tr" />
        <span className="auth-login-backdrop__corner auth-login-backdrop__corner--bl" />
        <span className="auth-login-backdrop__corner auth-login-backdrop__corner--br" />
      </div>

      <div className="auth-login-shell">
        <header className="auth-login-top">
          <img
            src="/jarvis-login-brand.png?v=1"
            alt="Jarvis — Automatiza. Conecta. Simplifica."
            className="auth-login-top__logo"
          />
        </header>

        <section className="auth-login-card" aria-labelledby="login-title">
          <div className="auth-login-card__intro">
            <h1 id="login-title">Iniciar sesión</h1>
            <p>Usa tu correo corporativo para entrar al panel.</p>
          </div>

          <form className="auth-login-form" onSubmit={handleSubmit}>
            <div
              className={`auth-login-form__field${
                errorKind === 'account_not_found'
                  ? ' auth-login-form__field--invalid'
                  : ''
              }`}
            >
              <label htmlFor="login-email">Correo</label>
              <input
                id="login-email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="correo@empresa.com"
                required
                disabled={isSubmitting}
                aria-invalid={errorKind === 'account_not_found'}
              />
            </div>

            <div
              className={`auth-login-form__field${
                errorKind === 'invalid_password'
                  ? ' auth-login-form__field--invalid'
                  : ''
              }`}
            >
              <label htmlFor="login-password">Contraseña</label>
              <input
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Tu contraseña"
                required
                disabled={isSubmitting}
                aria-invalid={errorKind === 'invalid_password'}
              />
            </div>

            {errorMessage && <ErrorMessage message={errorMessage} />}

            <button
              type="submit"
              className="auth-login-form__submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Ingresando...' : 'Continuar'}
            </button>
          </form>
        </section>

        <p className="auth-login-shell__footer">
          ¿No tienes cuenta? <Link to="/registro">Crear cuenta</Link>
        </p>
      </div>
    </main>
  )
}

export default LoginPage
