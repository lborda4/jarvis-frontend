import { useState, type FormEvent } from 'react'
import type { AdminJarvisTopUp, AdminPlan } from '../types/admin'
import { INTEGRATION_PROVIDER } from '../types/admin'
import { updateAdminPlan } from '../services/adminService'
import { getApiErrorMessage } from '../services/apiClient'
import Button from './Button'
import ErrorMessage from './ErrorMessage'
import SuccessMessage from './SuccessMessage'
import LoadingIndicator from './LoadingIndicator'
import './AdminPlans.css'
import { formatAdminPlanCapacity, formatAdminPlanPrice, formatCop } from '../utils/adminPlan'

function PlanEditor({ plan, editing, onEdit, onUpdated }: { plan: AdminPlan; editing: boolean; onEdit: (editing: boolean) => void; onUpdated: (plan: AdminPlan) => void }) {
  const [name, setName] = useState(plan.name)
  const [limit, setLimit] = useState(String(plan.documentLimit ?? ''))
  const [unlimited, setUnlimited] = useState(plan.documentLimit === null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [commissionClass, setCommissionClass] = useState(plan.commissionClass ?? '')
  const [price, setPrice] = useState(plan.salePriceCop == null ? '' : String(plan.salePriceCop))
  const provider = plan.provider === INTEGRATION_PROVIDER.SIIGO ? 'Siigo' : 'Jarvis'

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const documentLimit = unlimited ? null : Number(limit)
    if (!name.trim() || (!unlimited && (!limit.trim() || !Number.isInteger(documentLimit) || documentLimit! < 1 || documentLimit! > 2147483647))) {
      setError('Ingrese un nombre y un cupo entero mayor que cero.')
      return
    }
    if (!plan.commercialTerms && price.trim() && (!Number.isFinite(Number(price)) || Number(price) < 0 || Number(price) > 999999999999.99)) {
      setError('Ingresa un precio válido mayor o igual a cero.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const updated = await updateAdminPlan(plan.id, { name: name.trim(), documentLimit, commissionClass: commissionClass ? commissionClass as NonNullable<AdminPlan['commissionClass']> : null,
        ...(!plan.commercialTerms ? { salePriceCop: price.trim() ? Number(price) : null } : {}) })
      onUpdated(updated)
      onEdit(false)
      setSuccess(true)
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo guardar el plan.'))
    } finally {
      setSaving(false)
    }
  }

  return <article className={`admin-plan-editor${editing ? ' admin-plan-editor--editing' : ''}`}>
    <div className="admin-plan-editor__labels"><span className={`admin-plans__badge${plan.provider === INTEGRATION_PROVIDER.SIIGO ? ' admin-plans__badge--siigo' : ''}`}>{provider}</span><span>{planProduct(plan)}</span></div>
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
      <label className="admin-form__field">Clase de comisión<select value={commissionClass} onChange={event => setCommissionClass(event.target.value as typeof commissionClass)} disabled={saving}><option value="">Sin configurar</option><option value="BASIC">Básica · 10 %</option><option value="PLUS">Plus · 15 %</option><option value="PRO">Pro · 20 %</option></select></label>
      {!plan.commercialTerms && <label className="admin-form__field">Precio de venta (COP)<input type="number" min="0" max="999999999999.99" step="0.01" value={price} onChange={event => setPrice(event.target.value)} disabled={saving} /></label>}
      <p className="admin-plan-editor__notice">El cambio se aplicará a todas las empresas que tengan este plan.</p>
      <div className="admin-plan-editor__actions">
        <Button type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Guardar plan'}</Button>
        <Button variant="outline" disabled={saving} onClick={() => { onEdit(false); setError(null) }}>Cancelar</Button>
      </div>
    </form> : <>
      <div className="admin-plan-editor__summary"><h3>{plan.name}</h3>
        <p className="admin-plan-editor__price">{plan.commercialTerms ? formatAdminPlanPrice(plan) : plan.salePriceCop != null ? formatCop(plan.salePriceCop) : 'Precio sin configurar'}</p>
      </div>
      <div className="admin-plan-editor__capacity">{formatAdminPlanCapacity(plan)}</div>
      {plan.commercialTerms && <ul className="admin-plan-editor__features">
        {plan.commercialTerms.includesDigitalCertificate && <li>Certificado digital</li>}
        {plan.commercialTerms.includesRadian && <li>Radian incluido</li>}
      </ul>}
      <div className="admin-plan-editor__footer"><span className="admin-plan-editor__commission">Comisión<strong>{commissionLabel(plan.commissionClass)}</strong></span>
        <Button variant="outline" aria-label={`Editar plan ${provider} ${plan.name}`} onClick={() => {
          setName(plan.name); setLimit(String(plan.documentLimit ?? '')); setUnlimited(plan.documentLimit === null)
          setCommissionClass(plan.commissionClass ?? ''); setPrice(plan.salePriceCop == null ? '' : String(plan.salePriceCop))
          setSuccess(false); setError(null); onEdit(true)
        }}>Editar plan</Button>
      </div>
    </>}
    {error && <ErrorMessage message={error} />}
    {success && <SuccessMessage message="Plan actualizado." />}
  </article>
}

const commissionLabel = (tier: AdminPlan['commissionClass']) => tier === 'BASIC' ? 'Básica · 10 %' : tier === 'PLUS' ? 'Plus · 15 %' : tier === 'PRO' ? 'Pro · 20 %' : 'Sin configurar'
const planProduct = (plan: AdminPlan) => {
  if (plan.provider === INTEGRATION_PROVIDER.SIIGO) return 'Contabilidad'
  const modules = plan.commercialTerms?.modules ?? []
  return modules.includes('BILLING') && modules.includes('PAYROLL') ? 'Facturación + Nómina' : modules.includes('PAYROLL') ? 'Nómina' : 'Facturación'
}
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim()

export default function AdminPlans({ plans, topUps = [], loading, onUpdated }: { plans: AdminPlan[]; topUps?: AdminJarvisTopUp[]; loading: boolean; onUpdated: (plan: AdminPlan) => void }) {
  const [view, setView] = useState<'plans' | 'topUps'>('plans')
  const [search, setSearch] = useState(''), [provider, setProvider] = useState(''), [product, setProduct] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  if (loading) return <LoadingIndicator message="Cargando catálogo…" />
  const matches = (text: string) => normalize(text).includes(normalize(search))
  const visiblePlans = plans.filter(plan => (!provider || plan.provider === provider) && (!product || planProduct(plan) === product) && matches(`${plan.name} ${plan.code} ${planProduct(plan)}`))
    .sort((a, b) => a.provider.localeCompare(b.provider) || planProduct(a).localeCompare(planProduct(b), 'es') || (a.commercialTerms?.priceCop ?? a.salePriceCop ?? Infinity) - (b.commercialTerms?.priceCop ?? b.salePriceCop ?? Infinity) || a.name.localeCompare(b.name, 'es'))
  const visibleTopUps = topUps.filter(item => (!provider || provider === INTEGRATION_PROVIDER.JARVIS) && (!product || product === (item.kind === 'DOCUMENTS' ? 'Facturación' : 'Nómina')) && matches(`${item.name} ${item.code}`))
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.units - b.units)
  const count = view === 'plans' ? visiblePlans.length : visibleTopUps.length
  const clearFilters = () => { setSearch(''); setProvider(''); setProduct(''); setEditingId(null) }
  return <div className="admin-plans">
    <section className="admin-card admin-plans__toolbar" aria-label="Catálogo de planes y recargas">
      <div className="admin-plans__heading"><div><h2>Catálogo comercial</h2><p>Planes y recargas de tus integraciones.</p></div><div className="admin-plans__tabs" aria-label="Tipo de producto">
        <Button variant={view === 'plans' ? 'primary' : 'ghost'} aria-pressed={view === 'plans'} onClick={() => { setView('plans'); clearFilters() }}>Planes <span>{plans.length}</span></Button>
        <Button variant={view === 'topUps' ? 'primary' : 'ghost'} aria-pressed={view === 'topUps'} onClick={() => { setView('topUps'); clearFilters() }}>Recargas <span>{topUps.length}</span></Button>
      </div></div>
      <div className="admin-plans__filters">
        <label className="admin-form__field">Buscar<input type="search" placeholder={view === 'plans' ? 'Nombre o código del plan' : 'Nombre o código de la recarga'} value={search} onChange={event => { setSearch(event.target.value); setEditingId(null) }} /></label>
        {view === 'plans' && <label className="admin-form__field">Integración<select value={provider} onChange={event => { setProvider(event.target.value); setEditingId(null) }}><option value="">Todas</option><option value="JARVIS">Jarvis</option><option value="SIIGO">Siigo</option></select></label>}
        <label className="admin-form__field">Producto<select value={product} onChange={event => { setProduct(event.target.value); setEditingId(null) }}><option value="">Todos</option><option value="Facturación">Facturación</option><option value="Nómina">Nómina</option>{view === 'plans' && <><option value="Facturación + Nómina">Facturación + Nómina</option><option value="Contabilidad">Contabilidad</option></>}</select></label>
      </div>
    </section>
    <div className="admin-plans__result"><h2>{view === 'plans' ? 'Planes disponibles' : 'Recargas disponibles'} <span>({count})</span></h2>{view === 'topUps' && <span>Vigentes durante la suscripción</span>}</div>
    {count ? <div className="admin-plans__grid">
      {view === 'plans' ? visiblePlans.map(plan => <PlanEditor key={plan.id} plan={plan} editing={editingId === plan.id} onEdit={value => setEditingId(value ? plan.id : null)} onUpdated={onUpdated} />) : visibleTopUps.map(item => <article key={item.code} className="admin-plan-editor admin-plan-editor--topup">
        <div className="admin-plan-editor__labels"><span className="admin-plans__badge">Jarvis</span><span>{item.kind === 'DOCUMENTS' ? 'Facturación' : 'Nómina'}</span></div>
        <h3>{item.name}</h3><p className="admin-plan-editor__price">{formatCop(item.priceCop)}</p>
        <div className="admin-plan-editor__capacity">{item.units.toLocaleString('es-CO')} {item.kind === 'DOCUMENTS' ? 'documentos' : item.units === 1 ? 'empleado' : 'empleados'}</div>
        <div className="admin-plan-editor__footer"><span className="admin-plan-editor__commission">Comisión<strong>{commissionLabel(item.commissionClass)}</strong></span><span className="admin-plan-editor__unit-price">Por recarga</span></div>
      </article>)}
    </div> : <section className="admin-card admin-plans__empty"><h3>No hay resultados</h3><p>Prueba con otro nombre o cambia los filtros.</p><Button variant="outline" onClick={clearFilters}>Limpiar filtros</Button></section>}
  </div>
}
