import { useState } from 'react'
import type { AdminCompanyListItem } from '../types/admin'
import { sendCompanyWelcome } from '../services/adminService'
import { getApiErrorMessage } from '../services/apiClient'

export default function AdminCompanyWelcome({ company, onSent }: { company: AdminCompanyListItem; onSent: (email: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [email, setEmail] = useState(company.registrationEmail || company.responsible?.email || company.email || '')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState(false)
  return <div className="admin-nextpyme-token">
    {editing ? <>
      <label>Correo de bienvenida<input type="email" aria-label={`Correo de bienvenida de ${company.name}`} value={email} onChange={event => setEmail(event.target.value)} disabled={busy} maxLength={254} /></label>
      <small>El enlace nuevo será válido durante 72 horas y reemplazará los enlaces pendientes de ese correo.</small>
      <button type="button" disabled={busy || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())} onClick={async () => {
        if (busy) return
        setBusy(true); setMessage(''); setError(false)
        try {
          const result = await sendCompanyWelcome(company.id, email.trim())
          setMessage(result.message); setError(result.status !== 'SENT')
          if (result.status === 'SENT') { onSent(email.trim().toLowerCase()); setEditing(false) }
        } catch (error) { setError(true); setMessage(getApiErrorMessage(error, 'No se pudo enviar la bienvenida.')) }
        finally { setBusy(false) }
      }}>{busy ? 'Enviando…' : 'Enviar bienvenida'}</button>
      <button type="button" disabled={busy} onClick={() => setEditing(false)}>Cancelar</button>
    </> : <><span>{company.registrationEmail || 'Sin bienvenida enviada'}</span><button type="button" onClick={() => { setEditing(true); setMessage('') }}>Enviar / reenviar</button></>}
    {message && <small role={error ? 'alert' : 'status'}>{message}</small>}
  </div>
}
