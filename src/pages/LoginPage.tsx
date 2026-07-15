import { Link, Navigate, useNavigate } from 'react-router-dom'
import { type FormEvent, useState } from 'react'
import ErrorMessage from '../components/ErrorMessage'
import LoadingIndicator from '../components/LoadingIndicator'
import { getAuthErrorMessage, useAuth } from '../context/AuthContext'
import { setAuthEntryMode } from '../utils/siigoSetupStorage'
import '../pages/InvoiceUpload.css'
import './AuthPages.css'

const LOGIN_LANDING_PATH = '/documento-soporte'

function LoginPage() {
  const navigate = useNavigate()
  const { login, isAuthenticated, isLoading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const redirectPath = LOGIN_LANDING_PATH

  if (!isLoading && isAuthenticated) {
    return <Navigate to={redirectPath} replace />
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    setIsSubmitting(true)

    try {
      await login({
        email: email.trim(),
        password,
      })
      setAuthEntryMode('login')
      navigate(LOGIN_LANDING_PATH, { replace: true })
    } catch (error) {
      setErrorMessage(
        getAuthErrorMessage(error, 'No se pudo iniciar sesión. Intenta nuevamente.'),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="auth-page">
        <LoadingIndicator message="Cargando..." />
      </div>
    )
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <header className="auth-card__header">
          <p className="auth-card__eyebrow">Bienvenido</p>
          <h1>Iniciar sesión</h1>
          <p>Ingresa con tu correo y contraseña para continuar.</p>
        </header>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-form__field">
            <label htmlFor="login-email">Correo</label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="correo@empresa.com"
              required
              disabled={isSubmitting}
            />
          </div>

          <div className="auth-form__field">
            <label htmlFor="login-password">Contraseña</label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              required
              disabled={isSubmitting}
            />
          </div>

          {errorMessage && <ErrorMessage message={errorMessage} />}

          <button
            type="submit"
            className="auth-form__submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Ingresando...' : 'Iniciar sesión'}
          </button>
        </form>

        <p className="auth-card__footer">
          ¿No tienes cuenta? <Link to="/registro">Crear cuenta</Link>
        </p>
      </section>
    </main>
  )
}

export default LoginPage
