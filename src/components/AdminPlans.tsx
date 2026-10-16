import { useState, type FormEvent } from 'react'
import type { AdminPlan } from '../types/admin'
import { INTEGRATION_PROVIDER } from '../types/admin'
import { updateAdminPlan } from '../services/adminService'
import { getApiErrorMessage } from '../services/apiClient'
import ErrorMessage from './ErrorMessage'
import SuccessMessage from './SuccessMessage'
import LoadingIndicator from './LoadingIndicator'
import './AdminPlans.css'

function PlanEditor({ plan, onUpdated }: { plan: AdminPlan; onUpdated: (plan: AdminPlan) => void }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(plan.name)
  const [limit, setLimit] = useState(String(plan.documentLimit ?? ''))
  const [unlimited, setUnlimited] = useState(plan.documentLimit === null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const provider = plan.provider === INTEGRATION_PROVIDER.SIIGO ? 'Siigo' : 'Jarvis'

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const documentLimit = unlimited ? null : Number(limit)
    if (!name.trim() || (!unlimited && (!limit.trim() || !Number.isInteger(documentLimit) || documentLimit! < 1 || documentLimit! > 2147483647))) {
      setError('Ingrese un nombre y un cupo entero mayor que cero.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const updated = await updateAdminPlan(plan.id, { name: name.trim(), documentLimit })
      onUpdated(updated)
      setEditing(false)
      setSuccess(true)
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo guardar el plan.'))
    } finally {
      setSaving(false)
    }
  }

  return <article className="admin-plan-editor">
    {editing ? <form className="admin-form" onSubmit={event => void save(event)} aria-label={`Editar plan ${provider} ${plan.name}`}>
      <div className="admin-form__field">
        <label htmlFor={`plan-name-${plan.id}`}>Nombre del plan {provider}</label>
        <input id={`plan-name-${plan.id}`} value={name} onChange={event => setName(event.target.value)} required maxLength={255} disabled={saving} />
      </div>
      <label className="admin-form__checkbox"><input type="checkbox" checked={unlimited} onChange={event => setUnlimited(event.target.checked)} disabled={saving} />Sin límite de documentos</label>
      {!unlimited && <div className="admin-form__field">
        <label htmlFor={`plan-limit-${plan.id}`}>Documentos incluidos</label>
        <input id={`plan-limit-${plan.id}`} type="number" min={1} max={2147483647} step={1} required value={limit} onChange={event => setLimit(event.target.value)} disabled={saving} />
      </div>}
      <p className="admin-plan-editor__notice">El cambio se aplicará a todas las empresas que tengan este plan.</p>
      <div className="admin-plan-editor__actions">
        <button type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Guardar plan'}</button>
        <button type="button" disabled={saving} onClick={() => { setEditing(false); setError(null) }}>Cancelar</button>
      </div>
    </form> : <div className="admin-plan-editor__summary">
      <div><h3>{plan.name}</h3><p>{plan.documentLimit === null ? 'Sin límite de documentos' : `${plan.documentLimit} documentos`}</p></div>
      <button type="button" aria-label={`Editar plan ${provider} ${plan.name}`} onClick={() => {
        setName(plan.name); setLimit(String(plan.documentLimit ?? '')); setUnlimited(plan.documentLimit === null)
        setSuccess(false); setError(null); setEditing(true)
      }}>Editar</button>
    </div>}
    {error && <ErrorMessage message={error} />}
    {success && <SuccessMessage message="Plan actualizado." />}
  </article>
}

export default function AdminPlans({ plans, loading, onUpdated }: { plans: AdminPlan[]; loading: boolean; onUpdated: (plan: AdminPlan) => void }) {
  if (loading) return <LoadingIndicator message="Cargando planes..." />
  return <div className="admin-plans">
    <p>Administra los planes de cada integración. El cupo de documentos se define dentro del plan.</p>
    {[INTEGRATION_PROVIDER.SIIGO, INTEGRATION_PROVIDER.JARVIS].map(provider => {
      const items = plans.filter(plan => plan.provider === provider).sort((a, b) => (a.documentLimit ?? Infinity) - (b.documentLimit ?? Infinity) || a.name.localeCompare(b.name))
      return <section className="admin-card" key={provider} aria-labelledby={`plans-heading-${provider}`}>
        <div className="admin-card__header"><h2 id={`plans-heading-${provider}`}>Planes de {provider === INTEGRATION_PROVIDER.SIIGO ? 'Siigo' : 'Jarvis'}</h2></div>
        {items.length ? items.map(plan => <PlanEditor key={plan.id} plan={plan} onUpdated={onUpdated} />) : <p className="admin-empty">No hay planes disponibles para esta integración.</p>}
      </section>
    })}
  </div>
}
