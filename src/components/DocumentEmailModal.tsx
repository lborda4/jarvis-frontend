import { useEffect, useState, type FormEvent } from 'react'
import Modal from './Modal'
import Button from './Button'
import ErrorMessage from './ErrorMessage'
import LoadingIndicator from './LoadingIndicator'
import { fetchJarvisInvoicePdfData, sendJarvisDocumentEmail } from '../services/jarvisService'
import './DocumentEmailModal.css'

export function MailIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7" strokeLinejoin="round"/></svg>
}

export default function DocumentEmailModal({ id, number, documentLabel, partyLabel, onClose }: {
  id: string; number: string; documentLabel: string; partyLabel: string; onClose: () => void
}) {
  const [email, setEmail] = useState('')
  const [additional, setAdditional] = useState('')
  const [message, setMessage] = useState(`Hola,\nAdjuntamos ${documentLabel} ${number}.\nQuedamos atentos a cualquier inquietud.`)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    fetchJarvisInvoicePdfData(id).then(data => {
      if (active) { setEmail(data.buyer.email?.trim() ?? ''); setError(null) }
    }).catch(() => {
      if (active) setError('No se pudo consultar el correo registrado. Inténtalo más tarde o comunícate con soporte.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id, attempt])

  async function send(event: FormEvent) {
    event.preventDefault()
    if (saving || loading) return
    const additionalEmails = [...new Set(additional.split(',').map(value => value.trim().toLowerCase()).filter(Boolean))]
    if (additionalEmails.some(value => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))) {
      setError('Revisa los correos adicionales y sepáralos con coma.'); return
    }
    if (!email && !additionalEmails.length) { setError('Agrega al menos un correo para enviar el documento.'); return }
    setSaving(true); setError(null)
    try {
      const result = await sendJarvisDocumentEmail(id, { additionalEmails, message: message.trim() })
      if (!result.success) throw new Error('El envío no fue confirmado.')
      setSuccess(true)
    } catch { setError('Ha ocurrido un error en el envío del correo. Inténtalo más tarde o comunícate con soporte.') }
    finally { setSaving(false) }
  }

  return <Modal isOpen onClose={onClose} busy={saving} labelledBy="document-email-title" className="document-email">
    <header className="document-email__header"><span className="document-email__icon"><MailIcon /></span><div><h2 id="document-email-title">Enviar correo</h2><p>Se enviará el PDF de {documentLabel} al correo del {partyLabel.toLowerCase()} y a los correos adicionales que indiques.</p></div></header>
    {success ? <><p role="status" className="document-email__success">Correo enviado correctamente.</p><footer className="document-email__footer"><Button onClick={onClose}>Cerrar</Button></footer></>
      : loading ? <LoadingIndicator message="Consultando correo registrado..." />
      : <form onSubmit={event => void send(event)}>
        <label className="document-email__field">Correo del {partyLabel.toLowerCase()}<span className="document-email__registered"><input aria-label={`Correo del ${partyLabel.toLowerCase()}`} value={email} readOnly placeholder="Sin correo registrado" />{email && <span>Correo registrado</span>}</span></label>
        <label className="document-email__field">Correos adicionales (opcional)<input value={additional} onChange={event => setAdditional(event.target.value)} placeholder="ejemplo@correo.com, otro@correo.com" disabled={saving} /><small>Separa los correos con coma (,)</small></label>
        <label className="document-email__field">Mensaje (opcional)<textarea value={message} maxLength={500} rows={4} onChange={event => setMessage(event.target.value)} disabled={saving} /><small className="document-email__counter">{message.length}/500</small></label>
        {error && <ErrorMessage inline message={error} />}
        {error && !email && <Button type="button" variant="ghost" disabled={saving} onClick={() => { setLoading(true); setAttempt(value => value + 1) }}>Consultar correo nuevamente</Button>}
        <footer className="document-email__footer"><Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button><Button type="submit" disabled={saving}><MailIcon /> {saving ? 'Enviando...' : 'Enviar correo'}</Button></footer>
      </form>}
  </Modal>
}
