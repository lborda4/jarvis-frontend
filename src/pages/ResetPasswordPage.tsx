import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { type FormEvent, useEffect, useState } from 'react'
import AuthLoginFrame from '../components/AuthLoginFrame'
import Button from '../components/Button'
import ErrorMessage from '../components/ErrorMessage'
import LoadingIndicator from '../components/LoadingIndicator'
import { useBackendWakeup } from '../hooks/useBackendWakeup'
import { getApiErrorMessage } from '../services/apiClient'
import { resetPassword } from '../services/authService'
import { publicAuthResetError } from '../utils/passwordResetError'
import './AuthPages.css'

function ResetPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { isWaking, ensureReady, loadingMessage } = useBackendWakeup()
  const [token] = useState(() => searchParams.get('token')?.trim() ?? '')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [updated, setUpdated] = useState(false)

  useEffect(() => {
    if (searchParams.has('token')) {
      navigate('/restablecer-contrasena', { replace: true })
    }
  }, [navigate, searchParams])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)

    if (password.length < 6) {
      setErrorMessage('La contraseña debe tener al menos 6 caracteres.')
      return
    }

    if (password !== confirmation) {
      setErrorMessage('Las contraseñas no coinciden.')
      return
    }

    setIsSubmitting(true)

    try {
      await ensureReady()
      await resetPassword(token, password)
      setUpdated(true)
    } catch (error) {
      const fallback = 'No se pudo restablecer la contraseña. Solicita un enlace nuevo.'
      setErrorMessage(publicAuthResetError(getApiErrorMessage(error, fallback), fallback))
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
      titleId="reset-password-title"
      title="Nueva contraseña"
      description="Elige una contraseña de al menos 6 caracteres."
      footer={
        <p className="auth-login-shell__footer">
          <Link to="/login">Volver a iniciar sesión</Link>
        </p>
      }
    >
      {updated ? (
        <p className="auth-login-form__note">
          Tu contraseña fue actualizada. Ya puedes iniciar sesión.
        </p>
      ) : !token ? (
        <p className="auth-login-form__note">
          El enlace no es válido o ya expiró.{' '}
          <Link to="/olvide-mi-contrasena">Solicita uno nuevo</Link>.
        </p>
      ) : (
        <form className="auth-login-form" onSubmit={handleSubmit}>
          <div className="auth-login-form__field">
            <label htmlFor="reset-password">Contraseña nueva</label>
            <div className="auth-login-form__password">
              <input
                id="reset-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Mínimo 6 caracteres"
                required
                minLength={6}
                disabled={isSubmitting}
              />
              <button
                type="button"
                className="auth-login-form__password-toggle"
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                disabled={isSubmitting}
                onClick={() => setShowPassword((value) => !value)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                  <circle cx="12" cy="12" r="3" />
                  {showPassword && <path d="m3 3 18 18" />}
                </svg>
              </button>
            </div>
          </div>
          <div className="auth-login-form__field">
            <label htmlFor="reset-password-confirm">Confirmar contraseña</label>
            <input
              id="reset-password-confirm"
              name="confirmation"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder="Repite la contraseña"
              required
              minLength={6}
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
            {isSubmitting ? 'Guardando...' : 'Guardar contraseña'}
          </Button>
        </form>
      )}
    </AuthLoginFrame>
  )
}

export default ResetPasswordPage
