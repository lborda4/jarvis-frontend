import type { AdminJarvisTopUp, AdminPlan } from '../types/admin'
import type { CommissionClass } from '../types/advisor'
import { formatCop } from '../utils/adminPlan'

const labels = { BASIC: 'Básica', PLUS: 'Plus', PRO: 'Pro' }
export default function AdvisorCommissionPreview({ plans, topUps, rates, topUpCommissionBasis = 'PENDING' }: { plans: AdminPlan[]; topUps: AdminJarvisTopUp[]; rates: Record<CommissionClass, number>; topUpCommissionBasis?: 'PLAN' | 'PRODUCT' | 'PENDING' }) {
  if (!plans.length) return null
  const items = plans.map(plan => ({ name: plan.name, price: plan.commercialTerms?.priceCop ?? plan.salePriceCop, tier: plan.commissionClass }))
  const jarvis = plans.find(plan => plan.provider === 'JARVIS')
  for (const item of topUps) items.push({ name: item.name, price: item.priceCop, tier: item.commissionClass ?? (topUpCommissionBasis === 'PLAN' ? jarvis?.commissionClass : null) })
  return <div className="advisor-preview"><h3>Tu comisión</h3>{items.map((item, index) => <p key={index}><span>{item.name}</span><strong>{item.price == null || !item.tier ? 'Pendiente de configurar' : `${labels[item.tier]} · ${rates[item.tier]} % · ${formatCop(Math.round(item.price * rates[item.tier]) / 100)}`}</strong></p>)}<small>Se suma al mes en que se registre el pago.</small></div>
}
