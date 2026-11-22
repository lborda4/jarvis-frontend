import type { AdminPlan } from '../types/admin'
import { formatAdminPlanCapacity, formatCop } from '../utils/adminPlan'

export default function CompanyPlanCards({ title, plans, value, onChange, disabled, name }: { title: string; plans: AdminPlan[]; value: string; onChange: (plan: AdminPlan) => void; disabled: boolean; name: string }) {
  return <fieldset className="company-create__plans"><legend>{title}</legend><div className="company-create__plan-grid">
    {plans.map(plan => <label key={plan.id} className={`company-create__plan${value === plan.id ? ' company-create__plan--selected' : ''}`}>
      <input type="radio" name={name} value={plan.id} checked={value === plan.id} required disabled={disabled} onChange={() => onChange(plan)} />
      <strong>{plan.name}</strong><span>{plan.commercialTerms?.priceCop != null || plan.salePriceCop != null ? formatCop(plan.commercialTerms?.priceCop ?? plan.salePriceCop!) : 'Valor sin configurar'}</span><small>{formatAdminPlanCapacity(plan)}</small>
    </label>)}
    {!plans.length && <p className="admin-empty">No hay planes disponibles.</p>}
  </div></fieldset>
}
