import { useId, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { configureAdminPayrollNumbering, fetchAdminPayrollNumbering, type AdminPayrollNumberingStatus } from '../services/adminService'
import { getApiErrorMessage } from '../services/apiClient'
import Button from './Button'
import Modal from './Modal'
import ErrorMessage from './ErrorMessage'
import SuccessMessage from './SuccessMessage'

export default function AdminPayrollNumberingSettings({ disabled }: { disabled?: boolean }) {
  const { user } = useAuth()
  if (user?.role !== 'admin' || !user.company?.id) return null
  return <PayrollNumberingControl key={user.company.id} companyId={user.company.id} companyName={user.company.name} disabled={disabled} />
}

function PayrollNumberingControl({ companyId, companyName, disabled }: { companyId: string; companyName: string; disabled?: boolean }) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<AdminPayrollNumberingStatus | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const load = async () => {
    if (busy) return
    setOpen(true); setBusy(true); setStatus(null); setError(''); setSuccess('')
    try { setStatus(await fetchAdminPayrollNumbering(companyId)) }
    catch (failure) { setError(getApiErrorMessage(failure, 'No se pudo consultar la numeración de nómina.')) }
    finally { setBusy(false) }
  }
  const configure = async () => {
    if (busy || !status || status.ranges.some(range => range.issue)) return
    setBusy(true); setError(''); setSuccess('')
    try {
      const result = await configureAdminPayrollNumbering(companyId)
      setStatus(result)
      setSuccess('Configuración de NI y NA enviada a NextPyme. Los consecutivos se verificaron y guardaron sin reiniciarlos.')
    } catch (failure) { setError(getApiErrorMessage(failure, 'No se pudo completar la numeración. Vuelve a consultar y reintenta.')) }
    finally { setBusy(false) }
  }
  return <>
    <div className="settings-card__actions"><Button variant="outline" disabled={disabled || busy} onClick={() => void load()}>Configurar numeración de nómina</Button></div>
    <Modal isOpen={open} busy={busy} onClose={() => setOpen(false)} labelledBy={`${id}-title`}>
      <h2 id={`${id}-title`}>Configurar numeración de nómina</h2>
      <p>{companyName}</p>
      <p>Se consultan las resoluciones de nómina y nota de ajuste en NextPyme. Al aplicar, se envía la configuración de ambas con los datos encontrados. Cada prefijo conserva su propio consecutivo.</p>
      {busy && <p role="status">{status ? 'Configurando y verificando NI y NA…' : 'Consultando rangos de nómina…'}</p>}
      {status && <ul>{status.ranges.map(range => <li key={range.prefix}>
        <p><strong>{range.prefix} · {range.typeDocumentId === 9 ? 'Nómina' : 'Nota de ajuste'}</strong> · {range.issue ? 'Requiere revisión' : range.configured ? 'Encontrado en NextPyme' : 'Pendiente de registrar'}</p>
        <p>Rango: {range.from}–{range.to}. Próximo documento: <strong>{range.prefix}{range.nextConsecutive}</strong>.</p>
        {range.issue && <p>{range.issue}</p>}
      </li>)}</ul>}
      <div className="settings-card__actions">
        <Button disabled={busy || !status || status.ranges.some(range => !!range.issue)} onClick={() => void configure()}>Aplicar configuración NI y NA</Button>
        <Button variant="outline" disabled={busy} onClick={() => void load()}>Volver a consultar</Button>
      </div>
      {error && <ErrorMessage inline message={error} />}
      {success && <SuccessMessage message={success} />}
    </Modal>
  </>
}
