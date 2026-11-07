import { Link } from 'react-router-dom'
import { type FormEvent, useState } from 'react'
import AuthLoginFrame from '../components/AuthLoginFrame'
import AuthStatusNotice from '../components/AuthStatusNotice'
import Button from '../components/Button'
import ErrorMessage from '../components/ErrorMessage'
import LoadingIndicator from '../components/LoadingIndicator'
import { useBackendWakeup } from '../hooks/useBackendWakeup'
import { getApiErrorMessage } from '../services/apiClient'
import { requestPasswordReset } from '../services/authService'
import { publicAuthResetError } from '../utils/passwordResetError'
import './AuthPages.css'

function ForgotPasswordPage() {
  const { isWaking, ensureReady, loadingMessage } = useBackendWakeup()
  const [email, setEmail] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    setIsSubmitting(true)

    try {
      await ensureReady()
      await requestPasswordReset(email.trim())
      setSent(true)
    } catch (error) {
      const status = typeof error === 'object' && error && 'response' in error
        ? (error as { response?: { status?: number } }).response?.status
        : undefined
      const fallback = 'No se pudo completar la solicitud. Intenta nuevamente.'
      const message = status === 400
        ? publicAuthResetError(getApiErrorMessage(error, fallback), fallback)
        : fallback
      setErrorMessage(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isWaking) {
    return (
      <div className="auth-loading-screen">
        <LoadingIndicator message={loadingMessage} />
      </div>
    )
  }

  return (
    <AuthLoginFrame
      titleId="forgot-password-title"
      title="Olvidé mi contraseña"
      description={sent ? undefined : 'Escribe el correo de tu cuenta y te enviaremos un enlace para elegir una nueva.'}
      footer={
        <p className="auth-login-shell__footer">
          <Link to="/login">Volver a iniciar sesión</Link>
        </p>
      }
    >
      {sent ? (
        <AuthStatusNotice title="Revisa tu correo" hint="¿No lo encuentras? Revisa también la carpeta de spam o correo no deseado.">
          Si hay una cuenta asociada al correo que ingresaste, recibirás un enlace para crear una nueva contraseña.
        </AuthStatusNotice>
      ) : (
        <form className="auth-login-form" onSubmit={handleSubmit}>
          <div className="auth-login-form__field">
            <label htmlFor="forgot-email">Correo</label>
            <input
              id="forgot-email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="correo@empresa.com"
              required
              disabled={isSubmitting}
            />
          </div>
          {errorMessage && <ErrorMessage message={errorMessage} />}
          <Button
            type="submit"
            variant="primary"
            className="auth-login-form__submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Enviando...' : 'Enviar enlace'}
          </Button>
        </form>
      )}
    </AuthLoginFrame>
  )
}

export default ForgotPasswordPage
