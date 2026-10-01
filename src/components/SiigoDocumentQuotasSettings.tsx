import { useEffect, useState, type FormEvent } from 'react'
import { apiClient, getApiErrorMessage } from '../services/apiClient'
import { companyQueryKey, invalidateQueryCache } from '../services/queryCache'
import { useAuth } from '../context/AuthContext'
import { useIntegrationSetup } from '../context/IntegrationSetupContext'
import { isAdminRole } from '../constants/userRole'
import type { SiigoSubscriptionStatus } from '../types/siigo'
import Button from './Button'
import ErrorMessage from './ErrorMessage'
import './SiigoDocumentQuotasSettings.css'

const ENDPOINT = '/integrations/siigo/document-quotas'
const TYPES = [
  { key: 'PURCHASE_INVOICE', field: 'purchaseInvoice', label: 'Facturas de compra' },
  { key: 'SUPPORT_DOCUMENT', field: 'supportDocument', label: 'Documentos soporte' },
] as const

export default function SiigoDocumentQuotasSettings() {
  const { user } = useAuth()
  const { refreshSetupStatus } = useIntegrationSetup()
  const [subscription, setSubscription] = useState<SiigoSubscriptionStatus | null>(null)
  const [values, setValues] = useState({ purchaseInvoice: '', supportDocument: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [retry, setRetry] = useState(0)
  const canEdit = isAdminRole(user?.role)
  const companyId = user?.company?.id

  useEffect(() => {
    let active = true
    apiClient.get<SiigoSubscriptionStatus>(ENDPOINT).then(({ data }) => {
      if (!active) return
      setSubscription(data)
      const purchase = data.documentQuotas?.PURCHASE_INVOICE
      const support = data.documentQuotas?.SUPPORT_DOCUMENT
      setValues({ purchaseInvoice: purchase ? String(purchase.documentLimit ?? '') : '0', supportDocument: support ? String(support.documentLimit ?? '') : '0' })
    }).catch(err => { if (active) setError(getApiErrorMessage(err, 'No se pudieron consultar los cupos.')) })
    return () => { active = false }
  }, [companyId, retry])

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (saving) return
    const purchaseInvoice = values.purchaseInvoice.trim() === '' ? null : Number(values.purchaseInvoice)
    const supportDocument = values.supportDocument.trim() === '' ? null : Number(values.supportDocument)
    if ([purchaseInvoice, supportDocument].some(value => value !== null && (!Number.isSafeInteger(value) || value < 0))) {
      setError('Los cupos deben ser números enteros mayores o iguales a cero.'); return
    }
    setSaving(true); setError(null); setSuccess(false)
    try {
      const { data } = await apiClient.put<SiigoSubscriptionStatus>(ENDPOINT, { purchaseInvoice, supportDocument })
      setSubscription(data)
      invalidateQueryCache(companyQueryKey(['siigo', 'credentials-status']))
      await refreshSetupStatus()
      setSuccess(true)
    } catch (err) { setError(getApiErrorMessage(err, 'No se pudieron guardar los cupos.')) }
    finally { setSaving(false) }
  }

  return <section className="settings-card siigo-document-quotas">
    <h2>Cupos de documentos</h2>
    <p>Facturas de compra y documentos soporte tienen cupos independientes. Solo los envíos completados consumen unidades.</p>
    {error && <ErrorMessage message={error} />}
    {!subscription ? error ? <Button onClick={() => { setError(null); setRetry(current => current + 1) }}>Reintentar</Button> : <p>Cargando cupos…</p> : <form onSubmit={save}>
      <div className="siigo-document-quotas__grid">
        {TYPES.map(type => {
          const quota = subscription.documentQuotas?.[type.key]
          return <div className="siigo-document-quotas__card" key={type.key}>
            <h3>{type.label}</h3>
            <strong className="siigo-document-quotas__remaining">{quota ? quota.remaining ?? 'Sin límite' : 'No incluido'}<small>{quota?.remaining != null ? ' disponibles' : ''}</small></strong>
            <p>{quota?.documentsUsed ?? 0} enviados · Cupo total: {quota ? quota.documentLimit ?? 'ilimitado' : '—'}</p>
            {canEdit && <label>Cupo total asignado<input type="number" min="0" step="1" value={values[type.field]} disabled={saving} placeholder="Sin límite" onChange={e => setValues(current => ({ ...current, [type.field]: e.target.value }))} /></label>}
          </div>
        })}
      </div>
      {canEdit && <><p>El cupo total incluye los documentos ya enviados. Usa 0 para detener nuevos envíos o deja el campo vacío para un cupo ilimitado.</p><Button type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar cupos'}</Button></>}
      {success && <p role="status">Cupos guardados correctamente.</p>}
    </form>}
  </section>
}
