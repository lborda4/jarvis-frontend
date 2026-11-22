import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import AuthLoginFrame from '../components/AuthLoginFrame'
import ErrorMessage from '../components/ErrorMessage'
import LoadingIndicator from '../components/LoadingIndicator'
import { useAuth, getAuthErrorMessage } from '../context/AuthContext'
import { useBackendWakeup } from '../hooks/useBackendWakeup'
import { fetchAdvisorRegistration } from '../services/authService'
import './AuthPages.css'

const storageKey = 'jarvis:advisor-registration-link'
const readToken = () => { try { return sessionStorage.getItem(storageKey) ?? '' } catch { return '' } }
export default function AdvisorRegistrationPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { register } = useAuth()
  const { ensureReady } = useBackendWakeup()
  const [token] = useState(() => params.get('token') ?? readToken())
  const [info, setInfo] = useState<{ name: string; email: string } | null>(null)
  const [error, setError] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(Boolean(token))
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!params.has('token')) return
    try { sessionStorage.setItem(storageKey, token) } catch { /* Keep the current page usable without browser storage. */ }
    navigate('/registro/asesor', { replace: true })
  }, [params, token, navigate])
  useEffect(() => {
    if (!token) return
    let cancelled = false
    void ensureReady().then(() => fetchAdvisorRegistration(token)).then(data => { if (!cancelled) { setInfo(data); setError('') } }).catch(failure => { if (!cancelled) setError(getAuthErrorMessage(failure, 'No se pudo validar el enlace. Solicita uno nuevo al administrador.')) }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [token, ensureReady, attempt])
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (busy || !info || !accepted) return
    if (password !== confirmation) { setError('Las contraseñas no coinciden.'); return }
    setBusy(true); setError('')
    try {
      await register({ advisorRegistration: true, registrationToken: token, password, acceptPrivacyPolicy: accepted })
      try { sessionStorage.removeItem(storageKey) } catch { /* No persistent token to remove. */ }
      navigate('/asesor', { replace: true })
    } catch (failure) { setError(getAuthErrorMessage(failure, 'No se pudo crear tu acceso.')) }
    finally { setBusy(false) }
  }
  return <AuthLoginFrame titleId="advisor-register-title" title="Crea tu cuenta de asesor" description={info ? `Hola, ${info.name}.` : undefined} footer={<p className="auth-login-shell__footer"><Link to="/login">Volver a iniciar sesión</Link></p>}>
    {loading ? <LoadingIndicator message="Preparando tu cuenta…" /> : !token ? <p className="auth-login-form__note">Abre el enlace de acceso enviado a tu correo.</p> : !info ? <><ErrorMessage inline message={error || 'El enlace no está disponible.'} /><button type="button" className="auth-privacy__accept" onClick={() => { setLoading(true); setAttempt(value => value + 1) }}>Reintentar</button></> : <form className="auth-login-form" onSubmit={event => void submit(event)}>
      <div className="auth-registration-recipient"><span>Correo de tu usuario</span><strong>{info.email}</strong></div>
      <label className="auth-login-form__field">Crea tu contraseña<input type="password" autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} required minLength={6} maxLength={128} disabled={busy} /></label>
      <label className="auth-login-form__field">Confirmar contraseña<input type="password" autoComplete="new-password" value={confirmation} onChange={event => setConfirmation(event.target.value)} required minLength={6} maxLength={128} disabled={busy} /></label>
      <div className="auth-privacy"><p className="auth-privacy__copy"><label><input type="checkbox" checked={accepted} onChange={event => setAccepted(event.target.checked)} required disabled={busy} /> Acepto la <Link to="/politica-de-tratamiento-de-datos" target="_blank" rel="noopener noreferrer">política de tratamiento de datos</Link>.</label></p></div>
      {error && <ErrorMessage inline message={error} />}<button type="submit" className="auth-login-form__submit" disabled={busy || !accepted || password.length < 6 || password !== confirmation}>{busy ? 'Creando cuenta…' : 'Crear mi cuenta'}</button>
    </form>}
  </AuthLoginFrame>
}
