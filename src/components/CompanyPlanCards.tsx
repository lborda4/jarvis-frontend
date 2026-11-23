import type { AdminPlan } from '../types/admin'
import { formatAdminPlanCapacity, formatAdminPlanPrice, formatCop } from '../utils/adminPlan'

export default function CompanyPlanCards({ title, plans, value, onChange, disabled, name, compact = false }: { title: string; plans: AdminPlan[]; value: string; onChange: (plan: AdminPlan) => void; disabled: boolean; name: string; compact?: boolean }) {
  if (compact) {
    const selected = plans.find(plan => plan.id === value)
    return <div className="company-create__plan-picker"><label className="admin-form__field" htmlFor={name}>{title}<select id={name} value={value} required disabled={disabled} onChange={event => { const plan = plans.find(item => item.id === event.target.value); if (plan) onChange(plan) }}><option value="">Selecciona un plan</option>{plans.map(plan => <option key={plan.id} value={plan.id}>{plan.name}{plan.commercialTerms ? ' · ' + formatAdminPlanPrice(plan) : plan.salePriceCop != null ? ' · ' + formatCop(plan.salePriceCop) : ''}</option>)}</select></label>
      {selected && <div className="company-create__selected-plan"><span className="company-create__selected-label">Plan seleccionado</span><strong>{selected.name}</strong><span className="company-create__selected-price">{selected.commercialTerms ? formatAdminPlanPrice(selected) : selected.salePriceCop != null ? formatCop(selected.salePriceCop) : 'Valor sin configurar'}</span><small>{formatAdminPlanCapacity(selected)}</small>{selected.commercialTerms && <div className="company-create__selected-features">{selected.commercialTerms.includesDigitalCertificate && <span>✓ Certificado digital</span>}{selected.commercialTerms.includesRadian && <span>✓ Radian incluido</span>}</div>}</div>}
      {!plans.length && <p className="admin-empty">No hay planes disponibles.</p>}
    </div>
  }
  return <fieldset className="company-create__plans"><legend>{title}</legend><div className="company-create__plan-grid">
    {plans.map(plan => <label key={plan.id} className={`company-create__plan${value === plan.id ? ' company-create__plan--selected' : ''}`}>
      <input type="radio" name={name} value={plan.id} checked={value === plan.id} required disabled={disabled} onChange={() => onChange(plan)} />
      <strong>{plan.name}</strong><span>{plan.commercialTerms?.priceCop != null || plan.salePriceCop != null ? formatCop(plan.commercialTerms?.priceCop ?? plan.salePriceCop!) : 'Valor sin configurar'}</span><small>{formatAdminPlanCapacity(plan)}</small>
    </label>)}
    {!plans.length && <p className="admin-empty">No hay planes disponibles.</p>}
  </div></fieldset>
}
