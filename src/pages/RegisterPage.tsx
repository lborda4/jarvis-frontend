import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { type FormEvent, useEffect, useState } from 'react'
import AuthLoginFrame from '../components/AuthLoginFrame'
import ErrorMessage from '../components/ErrorMessage'
import LoadingIndicator from '../components/LoadingIndicator'
import PrivacyPolicyConsent from '../components/PrivacyPolicyConsent'
import { getAuthErrorMessage, useAuth } from '../context/AuthContext'
import { useBackendWakeup } from '../hooks/useBackendWakeup'
import { fetchRegistrationPolicy } from '../services/authService'
import { getIntegrationPolicyById } from '../constants/integrationPolicies'
import type { RegistrationLinkInfo } from '../types/auth'
import { setAuthEntryMode } from '../utils/siigoSetupStorage'
import { readRegistrationPolicyAcceptance, registrationAcceptedPolicy, saveRegistrationPolicyAcceptance, clearRegistrationPolicyAcceptance } from '../utils/registrationPolicyAcceptance'
import { readRegistrationLink, rememberRegistrationLink, clearRegistrationLink } from '../utils/registrationLink'
import './AuthPages.css'

export default function RegisterPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { register } = useAuth()
  const { ensureReady } = useBackendWakeup()
  const [token] = useState(() => params.get('token') ?? readRegistrationLink())
  const [info, setInfo] = useState<RegistrationLinkInfo | null>(null)
  const [loading, setLoading] = useState(Boolean(token))
  const [attempt, setAttempt] = useState(0)
  const [loadError, setLoadError] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [policyAcceptance, setPolicyAcceptance] = useState(readRegistrationPolicyAcceptance)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const policy = info ? getIntegrationPolicyById(info.policyId) : undefined
  const savedPolicy = info ? registrationAcceptedPolicy(policyAcceptance, info.companyId, info.email) : undefined
  const acceptedPolicy = savedPolicy?.id === policy?.id ? savedPolicy : undefined
  const passwordsDiffer = !info?.existingAccount && confirmation.length > 0 && password !== confirmation

  useEffect(() => {
    if (!params.has('token')) return
    rememberRegistrationLink(token)
    navigate('/registro', { replace: true })
  }, [navigate, params, token])

  useEffect(() => {
    if (!token) return
    let active = true
    void Promise.resolve().then(async () => {
      if (!active) return
      setLoading(true); setLoadError(''); setInfo(null)
      try {
        await ensureReady()
        const result = await fetchRegistrationPolicy(token)
        if (!active) return
        const document = getIntegrationPolicyById(result.policyId)
        if (!document || document.version !== result.version) throw new Error('Actualiza la página para consultar la versión vigente del documento.')
        setInfo(result)
      } catch (error) {
        if (active) setLoadError(getAuthErrorMessage(error, 'No pudimos validar el enlace. Solicita uno nuevo al administrador de tu empresa.'))
      } finally { if (active) setLoading(false) }
    })
    return () => { active = false }
  }, [token, attempt, ensureReady])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSubmitting || !info || !acceptedPolicy) return
    if (!info.existingAccount && password !== confirmation) { setErrorMessage('Las contraseñas no coinciden.'); return }
    setIsSubmitting(true); setErrorMessage(null)
    try {
      await register({ registrationToken: token, password, acceptPrivacyPolicy: true, acceptedIntegrationPolicyId: acceptedPolicy.id })
      clearRegistrationPolicyAcceptance(); clearRegistrationLink()
      setAuthEntryMode('register')
      navigate('/inicio', { replace: true })
    } catch (error) {
      const code = (error as { response?: { data?: { code?: string } } })?.response?.data?.code
      if (code === 'REGISTRATION_POLICY_REQUIRED') { clearRegistrationPolicyAcceptance(); setPolicyAcceptance(null); setAttempt(value => value + 1) }
      setErrorMessage(getAuthErrorMessage(error, 'No se pudo completar el registro. Revisa el enlace o solicita uno nuevo.'))
    } finally { setIsSubmitting(false) }
  }

  return <AuthLoginFrame titleId="register-title" title={info?.existingAccount ? 'Conecta tu empresa' : '¡Bienvenido a Jarvis!'}
    description={info ? `Completa tu acceso a ${info.companyName}.` : undefined}
    footer={<p className="auth-login-shell__footer"><Link to="/login">Volver a iniciar sesión</Link></p>}>
    {!token ? <p className="auth-login-form__note">Para crear tu usuario, abre el enlace de bienvenida que enviamos a tu correo al crear la empresa. Si no lo recibiste, solicita un nuevo enlace a quien administra tu empresa.</p>
      : loading ? <LoadingIndicator message="Preparando tu cuenta…" />
        : loadError ? <div><ErrorMessage inline message={loadError} /><button type="button" className="auth-privacy__accept" onClick={() => setAttempt(value => value + 1)}>Reintentar</button></div>
          : info && policy ? <form className="auth-login-form" onSubmit={event => void handleSubmit(event)}>
            <div className="auth-registration-recipient"><span>Correo de tu usuario</span><strong>{info.email}</strong><small>Este correo está asociado a tu enlace de bienvenida.</small></div>
            {info.existingAccount && <p className="auth-login-form__note">Ya tienes una cuenta con este correo. Usa tu contraseña actual para vincular esta empresa. <Link to="/olvide-mi-contrasena">¿La olvidaste?</Link></p>}
            <div className="auth-login-form__field">
              <label htmlFor="register-password">{info.existingAccount ? 'Contraseña actual' : 'Crea tu contraseña'}</label>
              <div className="auth-login-form__password"><input id="register-password" type={showPassword ? 'text' : 'password'} autoComplete={info.existingAccount ? 'current-password' : 'new-password'} value={password} onChange={event => setPassword(event.target.value)} minLength={6} maxLength={128} required disabled={isSubmitting} />
                <button type="button" className="auth-login-form__password-toggle" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} disabled={isSubmitting}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />{showPassword && <path d="m3 3 18 18" />}</svg></button>
              </div>
              {!info.existingAccount && <small>Usa al menos 6 caracteres.</small>}
            </div>
            {!info.existingAccount && <div className={`auth-login-form__field${passwordsDiffer ? ' auth-login-form__field--invalid' : ''}`}><label htmlFor="register-confirmation">Confirmar contraseña</label><input id="register-confirmation" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={confirmation} onChange={event => setConfirmation(event.target.value)} aria-invalid={passwordsDiffer || undefined} aria-describedby={passwordsDiffer ? 'register-mismatch' : undefined} required minLength={6} maxLength={128} disabled={isSubmitting} />{passwordsDiffer && <p id="register-mismatch" role="alert">Las contraseñas no coinciden.</p>}</div>}
            <PrivacyPolicyConsent policy={policy} acceptedPolicy={acceptedPolicy} onAccepted={document => setPolicyAcceptance(saveRegistrationPolicyAcceptance(info.companyId, info.email, document))} disabled={isSubmitting} />
            {errorMessage && <ErrorMessage inline message={errorMessage} />}
            <button type="submit" className="auth-login-form__submit" disabled={isSubmitting || !acceptedPolicy || password.length < 6 || (!info.existingAccount && password !== confirmation)}>{isSubmitting ? 'Preparando tu acceso…' : info.existingAccount ? 'Vincular empresa' : 'Crear mi cuenta'}</button>
          </form> : null}
  </AuthLoginFrame>
}
