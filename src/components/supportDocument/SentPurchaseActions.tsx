import { useState } from 'react'
import Button from '../Button'
import ConfirmDialog from '../ConfirmDialog'
import { refreshSiigoPurchase } from '../../services/siigoService'
import { getApiErrorMessage } from '../../services/apiClient'

export default function SentPurchaseActions({ documentId, disabled, onEdit, onResend }: {
  documentId: string
  disabled: boolean
  onEdit: () => void
  onResend: () => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const [missing, setMissing] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState(false)
  const refresh = async () => {
    setBusy(true); setMissing(false); setMessage(''); setError('')
    try {
      const result = await refreshSiigoPurchase(documentId)
      setMissing(!result.exists)
      setMessage(result.exists ? 'La factura existe en SIIGO.' : 'La factura ya no está en SIIGO.')
    } catch (err) { setError(getApiErrorMessage(err, 'No se pudo consultar SIIGO. Intenta nuevamente.')) }
    finally { setBusy(false) }
  }
  const resend = async () => {
    setBusy(true); setError('')
    try { await onResend(); setMissing(false); setMessage('Factura reenviada a SIIGO.'); setConfirm(false) }
    catch (err) { setMissing(false); setMessage(''); setError(getApiErrorMessage(err, 'No se pudo reenviar la factura.')); setConfirm(false) }
    finally { setBusy(false) }
  }
  return <div className="support-table__sent-purchase">
    <div className="support-table__sent-actions">
      <Button variant="secondary" size="sm" disabled={disabled || busy} onClick={onEdit}>Editar</Button>
      <Button variant="secondary" size="sm" disabled={disabled || busy} onClick={() => void refresh()}
        title="Recargar estado en SIIGO" aria-label="Recargar estado en SIIGO">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6 8a7 7 0 0 1 12-2l2 3M18 16a7 7 0 0 1-12 2l-2-3" /></svg>
      </Button>
      {missing && <Button variant="secondary" size="sm" disabled={disabled || busy} onClick={() => setConfirm(true)}>Reenviar</Button>}
    </div>
    {busy && <small role="status">{confirm ? 'Reenviando a SIIGO…' : 'Consultando SIIGO…'}</small>}
    {!busy && message && <small role="status">{message}</small>}
    {error && <small role="alert">{error}</small>}
    <ConfirmDialog isOpen={confirm} title="Reenviar factura de compra" message="Se creará una nueva factura de compra en SIIGO con los datos actuales de este registro. Se comprobará nuevamente que la anterior ya no existe."
      confirmLabel="Reenviar" isBusy={busy} onConfirm={() => void resend()} onCancel={() => { if (!busy) setConfirm(false) }} />
  </div>
}
