import { Link, Navigate, useNavigate } from 'react-router-dom'
import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import Button from '../components/Button'
import ErrorMessage from '../components/ErrorMessage'
import LoadingIndicator from '../components/LoadingIndicator'
import { useAuth } from '../context/AuthContext'
import { useBackendWakeup } from '../hooks/useBackendWakeup'
import { isAdminRole } from '../constants/userRole'
import { resetBackendWake } from '../services/healthService'
import { setAuthEntryMode } from '../utils/siigoSetupStorage'
import {
  resolveLoginError,
  type LoginErrorKind,
} from '../utils/resolveLoginError'
import '../pages/InvoiceUpload.css'
import './AuthPages.css'

const DEFAULT_APP_PATH = '/documento-soporte'
const ADMIN_APP_PATH = '/admin'
/** Si el login se queda colgado por cold start, remonta y reintenta una vez. */
const LOGIN_STUCK_RERENDER_MS = 15_000

function resolvePostLoginPath(role?: string): string {
  return isAdminRole(role) ? ADMIN_APP_PATH : DEFAULT_APP_PATH
}

function LoginPage() {
  const navigate = useNavigate()
  const { login, isAuthenticated, isLoading, user } = useAuth()
  const {
    isSlow,
    isWaking,
    error: wakeError,
    attempt: wakeAttempt,
    ensureReady,
    retryWake,
    loadingMessage,
  } = useBackendWakeup()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [errorKind, setErrorKind] = useState<LoginErrorKind | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitIsSlow, setSubmitIsSlow] = useState(false)
  const [formKey, setFormKey] = useState(0)
  const [autoRetryLogin, setAutoRetryLogin] = useState(false)
  const loginRetryUsedRef = useRef(false)
  const credentialsRef = useRef({ email: '', password: '' })

  const redirectPath = resolvePostLoginPath(user?.role)

  useEffect(() => {
    credentialsRef.current = { email, password }
  }, [email, password])

  const runLogin = useCallback(
    async (credentials: { email: string; password: string }) => {
      setErrorMessage(null)
      setErrorKind(null)
      setIsSubmitting(true)
      setSubmitIsSlow(false)

      const slowTimer = window.setTimeout(() => {
        setSubmitIsSlow(true)
      }, 2500)

      try {
        await ensureReady()
        const loggedInUser = await login({
          email: credentials.email.trim(),
          password: credentials.password,
        })
        setAuthEntryMode('login')
        loginRetryUsedRef.current = false
        setAutoRetryLogin(false)
        navigate(resolvePostLoginPath(loggedInUser.role), { replace: true })
      } catch (error) {
        const resolved = resolveLoginError(
          error,
          'No se pudo iniciar sesión. Intenta nuevamente.',
        )
        setErrorMessage(resolved.message)
        setErrorKind(resolved.kind)
        setAutoRetryLogin(false)
      } finally {
        window.clearTimeout(slowTimer)
        setSubmitIsSlow(false)
        setIsSubmitting(false)
      }
    },
    [ensureReady, login, navigate],
  )

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    loginRetryUsedRef.current = false
    await runLogin({ email, password })
  }

  useEffect(() => {
    if (!isSubmitting || loginRetryUsedRef.current) {
      return
    }

    const stuckTimer = window.setTimeout(() => {
      loginRetryUsedRef.current = true
      setIsSubmitting(false)
      setSubmitIsSlow(false)
      setErrorMessage(null)
      resetBackendWake()
      retryWake()
      setFormKey((current) => current + 1)
      setAutoRetryLogin(true)
    }, LOGIN_STUCK_RERENDER_MS)

    return () => {
      window.clearTimeout(stuckTimer)
    }
  }, [isSubmitting, retryWake, formKey])

  useEffect(() => {
    if (!autoRetryLogin || isWaking || isLoading) {
      return
    }

    const { email: savedEmail, password: savedPassword } = credentialsRef.current
    if (!savedEmail.trim() || !savedPassword) {
      setAutoRetryLogin(false)
      return
    }

    setAutoRetryLogin(false)
    void runLogin({ email: savedEmail, password: savedPassword })
  }, [autoRetryLogin, isWaking, isLoading, wakeAttempt, formKey, runLogin])

  if (!isLoading && isAuthenticated) {
    return <Navigate to={redirectPath} replace />
  }

  if (isLoading || isWaking) {
    return (
      <div className="auth-loading-screen" key={`wake-${wakeAttempt}`}>
        <LoadingIndicator message={loadingMessage} />
        {wakeAttempt > 0 && (
          <p className="auth-loading-screen__hint">
            Estamos verificando tu conexión, esto puede tardar unos segundos.
          </p>
        )}
      </div>
    )
  }

  const submitLabel = isSubmitting
    ? submitIsSlow || isSlow
      ? 'Preparando tu sesión, espera un momento...'
      : 'Ingresando...'
    : autoRetryLogin
      ? 'Reintentando ingreso...'
      : 'Continuar'

  return (
    <main
      className="auth-page auth-page--login"
      key={`login-${formKey}-${wakeAttempt}`}
    >
      <aside className="auth-login-brand">
        <span className="auth-login-brand__glow" aria-hidden="true" />
        <img
          src="/jarvis-login-brand.png?v=1"
          alt="Jarvis"
          className="auth-login-brand__logo"
        />
        <div className="auth-login-brand__copy">
          <h2 className="auth-login-brand__title">
            Automatiza. Conecta. Simplifica.
          </h2>
          <p className="auth-login-brand__text">
            Documentos soporte, terceros e integración SIIGO/DIAN desde un
            solo panel de control.
          </p>
        </div>
      </aside>

      <div className="auth-login-shell">
        <section className="auth-login-card" aria-labelledby="login-title">
          <div className="auth-login-card__intro">
            <h1 id="login-title">Iniciar sesión</h1>
            <p>Usa tu correo corporativo para entrar al panel.</p>
          </div>

          {(wakeError || formKey > 0) && (
            <ErrorMessage
              message={
                formKey > 0
                  ? 'La conexión tardó demasiado. Reintentamos automáticamente.'
                  : wakeError!
              }
            />
          )}

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

            <Button
              type="submit"
              variant="primary"
              className="auth-login-form__submit"
              disabled={isSubmitting || autoRetryLogin}
            >
              {submitLabel}
            </Button>
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
