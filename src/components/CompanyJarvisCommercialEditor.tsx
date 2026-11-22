import { useRef, useState, type FormEvent } from 'react'
import type { AdminCompanyListItem, AdminIntegrationItem, AdminJarvisTopUp, AdminPlan } from '../types/admin'
import { compatibleTopUpCodes, formatAdminPlanOption, formatCop, formatTopUpOption } from '../utils/adminPlan'
import { applyAdminJarvisTopUp, updateIntegrationSubscription } from '../services/adminService'
import { getApiErrorMessage } from '../services/apiClient'
import Button from './Button'
import ErrorMessage from './ErrorMessage'
import JarvisPlanSelect from './JarvisPlanSelect'
import JarvisTopUpSelect from './JarvisTopUpSelect'
import JarvisCommercialSummary from './JarvisCommercialSummary'

const termDate = (value: string) => new Date(value).toLocaleDateString('es-CO', { timeZone: 'America/Bogota', day: '2-digit', month: '2-digit', year: 'numeric' })

export default function CompanyJarvisCommercialEditor({ company, integration, plans, catalog, onSaved, initialMode }: {
  company: AdminCompanyListItem
  integration: AdminIntegrationItem
  plans: AdminPlan[]
  catalog: AdminJarvisTopUp[]
  onSaved: (company: AdminCompanyListItem, message?: string) => void
  initialMode?: 'plan' | 'topUps'
}) {
  const pending = integration.topUpOperations?.find(item => (!integration.jarvisDocumentCycle || item.cycleId === integration.jarvisDocumentCycle.id) && (item.status === 'PROCESSING' || item.status === 'UNCERTAIN'))
  const [editing, setEditing] = useState<'plan' | 'topUps' | null>(initialMode ?? null)
  const [planId, setPlanId] = useState(integration.plan?.id ?? '')
  const [codes, setCodes] = useState<string[]>(initialMode === 'topUps' && pending ? pending.topUps.map(item => item.code) : [])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const busyRef = useRef(false)
  const [attempt, setAttempt] = useState<{ operationId: string; topUpCodes: string[] } | null>(initialMode === 'topUps' && pending ? { operationId: pending.id, topUpCodes: pending.topUps.map(item => item.code) } : null)
  const plan = plans.find(item => item.id === planId) ?? (integration.plan?.id === planId ? integration.plan : null)
  const topUps = catalog.filter(item => codes.includes(item.code))
  const startEditing = (mode: 'plan' | 'topUps') => {
    setPlanId(integration.plan?.id ?? '')
    if (mode === 'topUps') {
      const savedAttempt = pending ? { operationId: pending.id, topUpCodes: pending.topUps.map(item => item.code) } : attempt
      setAttempt(savedAttempt)
      setCodes(savedAttempt?.topUpCodes ?? (integration.pendingInitialDocuments ? (integration.commercialTopUps ?? []).filter(item => item.kind === 'DOCUMENTS').map(item => item.code) : []))
    } else setCodes([])
    setError(''); setEditing(mode)
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busyRef.current || !plan) return
    busyRef.current = true; setBusy(true); setError('')
    try {
      if (editing === 'topUps') {
        const request = attempt ?? { operationId: crypto.randomUUID(), topUpCodes: codes }
        setAttempt(request)
        const response = await applyAdminJarvisTopUp(company.id, request)
        if (!response.company) throw new Error('Consulta el estado de la recarga para confirmar el resultado.')
        onSaved(response.company, response.operation.status === 'APPLIED' ? `Recarga aplicada para ${company.name}.` : '')
        if (response.operation.status === 'APPLIED') { setAttempt(null); setEditing(null) }
        else if (response.operation.status === 'FAILED') {
          setAttempt(null)
          setError('La recarga no se aplicó. Revisa la configuración de NextPyme e intenta de nuevo.')
        } else setError('Recarga pendiente de confirmar en NextPyme. No vuelvas a aplicarla.')
        return
      }
      const response = await updateIntegrationSubscription(company.id, 'JARVIS', { planId: plan.id, topUpCodes: [] })
      if (!response.company) throw new Error('No se confirmó el cambio. Actualiza el listado para comprobar el resultado.')
      onSaved(response.company)
      setEditing(null)
    } catch (failure) { setError(getApiErrorMessage(failure, 'No se pudieron guardar los cambios.')) }
    finally { busyRef.current = false; setBusy(false) }
  }
  if (!editing) return <div className="admin-integration-stack__item">
    <span>{integration.plan ? formatAdminPlanOption(integration.plan) : 'Sin plan'}</span>
    {integration.jarvisCertificateTerm ? <>
      <span>Inicio: {termDate(integration.jarvisCertificateTerm.startsAt)}</span>
      <span>Vence: {termDate(integration.jarvisCertificateTerm.endsAt)}</span>
    </> : <span>Vigencia sin consultar</span>}
    {integration.documentQuota?.remaining != null && <strong>Documentos disponibles: {integration.documentQuota.remaining}</strong>}
    {pending && <span role="status">Recarga por confirmar</span>}
    {!!integration.topUpOperations?.some(item => item.topUps.length > 0) && <details>
      <summary>Historial de recargas ({integration.topUpOperations.filter(item => item.topUps.length > 0).length})</summary>
      {integration.topUpOperations.filter(item => item.topUps.length > 0).map(operation => <div key={operation.id}>
        <span>{new Date(operation.createdAt).toLocaleDateString('es-CO')} · {{ APPLIED: 'Aplicada', PROCESSING: 'Procesando', UNCERTAIN: 'Por confirmar', FAILED: 'No aplicada' }[operation.status]}</span>
        {operation.topUps.map(item => <div key={item.code}>{formatTopUpOption(item)}</div>)}
      </div>)}
    </details>}
    <div className="admin-plan-editor__actions">
      <Button variant="outline" onClick={() => startEditing('plan')}>Editar plan</Button>
      <Button variant="outline" disabled={!integration.plan} onClick={() => startEditing('topUps')}>{pending ? 'Ver recarga pendiente' : 'Recargar'}</Button>
    </div>
  </div>
  return <form className="admin-form" aria-label={`${editing === 'plan' ? 'Plan' : 'Recargas'} de ${company.name}`} onSubmit={event => void submit(event)}>
    {editing === 'plan' && <JarvisPlanSelect id={`edit-plan-${integration.id}`} plans={plans} includePlan={integration.plan} value={planId} disabled={busy} onChange={selected => {
      setPlanId(selected?.id ?? '')
      setCodes(compatibleTopUpCodes(selected, codes, catalog))
    }} />}
    {editing === 'topUps' && <>
      <JarvisTopUpSelect idPrefix={`edit-top-up-${integration.id}`} plan={plan} catalog={catalog} value={codes} onChange={setCodes} disabled={busy || Boolean(attempt)} />
      <strong>Total recarga: {formatCop(topUps.reduce((sum, item) => sum + item.priceCop, 0))}</strong>
    </>}
    {editing === 'plan' && plan && <JarvisCommercialSummary plan={plan} topUps={[]} />}
    {error && <ErrorMessage inline message={error} />}
    <div className="admin-plan-editor__actions">
      <Button type="submit" disabled={busy || !plan || (editing === 'topUps' && !codes.length)}>{busy ? 'Procesando…' : editing === 'plan' ? 'Guardar' : attempt ? 'Consultar estado' : 'Aplicar recarga'}</Button>
      <Button variant="outline" disabled={busy} onClick={() => setEditing(null)}>Cancelar</Button>
    </div>
  </form>
}
