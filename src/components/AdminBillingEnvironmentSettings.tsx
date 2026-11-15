import { useId, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { configureAdminBillingEnvironment, fetchAdminBillingEnvironment, type AdminBillingEnvironmentStatus } from '../services/adminService'
import { getApiErrorMessage } from '../services/apiClient'
import Button from './Button'
import Modal from './Modal'
import ErrorMessage from './ErrorMessage'
import SuccessMessage from './SuccessMessage'

export default function AdminBillingEnvironmentSettings({ disabled, onConfigured }: { disabled?: boolean; onConfigured?: () => void }) {
  const { user } = useAuth()
  if (user?.role !== 'admin' || !user.company?.id) return null
  return <BillingEnvironmentControl key={user.company.id} companyId={user.company.id} companyName={user.company.name} disabled={disabled} onConfigured={onConfigured} />
}

function BillingEnvironmentControl({ companyId, companyName, disabled, onConfigured }: { companyId: string; companyName: string; disabled?: boolean; onConfigured?: () => void }) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<AdminBillingEnvironmentStatus | null>(null)
  const [environment, setEnvironment] = useState<1 | 2>(2)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const load = async () => {
    setOpen(true); setBusy(true); setStatus(null); setError(''); setSuccess('')
    try {
      const result = await fetchAdminBillingEnvironment(companyId)
      setStatus(result); setEnvironment(result.environment ?? 2)
    } catch (failure) { setError(getApiErrorMessage(failure, 'No se pudo consultar el ambiente de facturación.')) }
    finally { setBusy(false) }
  }
  const save = async () => {
    if (busy || !status) return
    setBusy(true); setError(''); setSuccess('')
    try {
      const result = await configureAdminBillingEnvironment(companyId, environment)
      setStatus(result)
      setSuccess(`Facturación en ${environment === 2 ? 'pruebas' : 'producción'}. Próxima factura: ${result.resolution?.prefix ?? ''}${result.resolution?.nextConsecutive ?? ''}.`)
      onConfigured?.()
    } catch (failure) { setError(getApiErrorMessage(failure, 'No se pudo cambiar el ambiente de facturación.')) }
    finally { setBusy(false) }
  }
  return <>
    <div className="settings-card__actions"><Button variant="outline" disabled={disabled || busy} onClick={() => void load()}>Pruebas/producción facturación</Button></div>
    <Modal isOpen={open} busy={busy} onClose={() => setOpen(false)} labelledBy={`${id}-title`}>
      <h2 id={`${id}-title`}>Pruebas/producción facturación</h2>
      <p>{companyName}</p>
      {busy && <p role="status">{status ? 'Configurando ambiente y resolución…' : 'Consultando configuración…'}</p>}
      {status && <>
        <p>Ambiente guardado: <strong>{status.environment === 2 ? 'Pruebas' : status.environment === 1 ? 'Producción' : 'Sin seleccionar'}</strong></p>
        {status.resolution && <p>Próxima factura: <strong>{status.resolution.prefix}{status.resolution.nextConsecutive}</strong></p>}
        {status.pending && <p className="settings-page__setup-notice">El último cambio quedó incompleto. Reintenta para completar la configuración.</p>}
        <div className="settings-form__field">
          <label htmlFor={`${id}-environment`}>Ambiente de facturación</label>
          <select id={`${id}-environment`} disabled={busy} value={environment} onChange={event => { setEnvironment(Number(event.target.value) as 1 | 2); setSuccess('') }}>
            <option value="2">Pruebas</option><option value="1" disabled={!status.canRestoreProduction}>Producción</option>
          </select>
        </div>
        <p>{environment === 2 ? 'Se usará la resolución 18760000001, prefijo SETP, con rango 990000000–995000000. Se conservará el avance de ese prefijo.' : 'Se recuperará la resolución de producción y su consecutivo guardado.'}</p>
        {!status.canRestoreProduction && <p>Configura una resolución de producción antes de cambiar a pruebas si quieres poder recuperarla después.</p>}
        <div className="settings-card__actions"><Button disabled={busy || (environment === 1 && !status.canRestoreProduction)} onClick={() => void save()}>{busy ? 'Configurando…' : 'Aplicar ambiente'}</Button></div>
      </>}
      {!status && !busy && <Button variant="outline" onClick={() => void load()}>Reintentar</Button>}
      {error && <ErrorMessage inline message={error} />}
      {success && <SuccessMessage message={success} />}
    </Modal>
  </>
}
