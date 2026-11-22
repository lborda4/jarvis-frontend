import type { AdminPlan } from '../types/admin'
import { formatAdminPlanOption, isJarvisPortfolioPlan } from '../utils/adminPlan'

export default function JarvisPlanSelect({ plans, value, disabled, onChange, id = 'admin-company-plan-jarvis', includePlan }: {
  plans: AdminPlan[]
  value: string
  disabled?: boolean
  onChange: (plan: AdminPlan | null) => void
  id?: string
  includePlan?: AdminPlan | null
}) {
  const available = plans.filter(isJarvisPortfolioPlan)
  if (includePlan && !available.some(plan => plan.id === includePlan.id)) available.unshift(includePlan)
  return <div className="admin-form__field">
    <label htmlFor={id}>Plan Jarvis</label>
    <select id={id} value={value} required disabled={disabled || available.length === 0}
      onChange={event => onChange(available.find(plan => plan.id === event.target.value) ?? null)}>
      <option value="">{available.length ? 'Selecciona un plan' : 'Sin planes del portafolio disponibles'}</option>
      {available.map(plan => <option key={plan.id} value={plan.id}>{formatAdminPlanOption(plan)}</option>)}
    </select>
  </div>
}
