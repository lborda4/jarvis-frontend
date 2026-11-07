import { type FormEvent, useId, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { inviteAccountant } from '../services/authService'
import { getApiErrorMessage } from '../services/apiClient'
import ErrorMessage from './ErrorMessage'
import SuccessMessage from './SuccessMessage'
import './InviteAccountant.css'

export default function InviteAccountant() {
  const { user } = useAuth()
  return user?.company?.id ? <InvitationForm key={user.company.id} companyName={user.company.name} /> : null
}

function InvitationForm({ companyName }: { companyName: string }) {
  const id = useId()
  const sending = useRef(false)
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (sending.current || !email.trim()) return
    sending.current = true
    setBusy(true)
    setError('')
    setSuccess('')
    try {
      const result = await inviteAccountant(email.trim())
      if (result.status === 'SENT') {
        setSuccess(`Enviamos la bienvenida a ${email.trim()}. El enlace vence en 72 horas. Cuando complete el registro, tendrá acceso a ${companyName}.`)
        setEmail('')
        setOpen(false)
      } else {
        setError('No pudimos enviar la invitación. Intenta de nuevo; si el problema continúa, contacta a soporte.')
      }
    } catch (error) {
      setError(getApiErrorMessage(error, 'No pudimos enviar la invitación. Intenta de nuevo.'))
    } finally {
      sending.current = false
      setBusy(false)
    }
  }

  return <section className="invite-accountant" aria-labelledby={`${id}-title`}>
    <div className="invite-accountant__header">
      <div>
        <h2 id={`${id}-title`}>Trabaja con tu contador</h2>
        <p>Invítalo a {companyName} con su propio usuario. Tendrá acceso a la empresa y la persona a cargo conservará el suyo.</p>
      </div>
      <button type="button" className="import-siigo-button" aria-expanded={open} aria-controls={`${id}-form`} disabled={busy} onClick={() => { setOpen(value => !value); setError(''); setSuccess('') }}>Invitar al contador</button>
    </div>
    {open && <form id={`${id}-form`} className="invite-accountant__form settings-form" onSubmit={event => void submit(event)}>
      <div className="settings-form__field">
        <label htmlFor={`${id}-email`}>Correo del contador</label>
        <input id={`${id}-email`} type="email" autoComplete="email" placeholder="contador@correo.com" value={email} onChange={event => setEmail(event.target.value)} required maxLength={254} disabled={busy} aria-describedby={`${id}-hint`} />
        <small id={`${id}-hint`}>Recibirá un correo de bienvenida con su correo fijado para crear su contraseña y aceptar la política. Si ya tiene cuenta, usará su contraseña actual. Reenviar reemplaza únicamente el enlace pendiente de ese correo.</small>
      </div>
      <div className="invite-accountant__actions">
        <button type="submit" className="import-siigo-button" disabled={busy || !email.trim()} aria-busy={busy}>{busy ? 'Enviando invitación…' : 'Enviar invitación'}</button>
        <button type="button" className="invite-accountant__cancel" disabled={busy} onClick={() => { setOpen(false); setError('') }}>Cancelar</button>
      </div>
    </form>}
    {error && <ErrorMessage message={error} />}
    {success && <SuccessMessage message={success} />}
  </section>
}
