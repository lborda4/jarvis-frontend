import type { AdminJarvisTopUp, AdminPlan } from '../types/admin'
import { commercialSelectionTotal, formatAdminPlanPrice, formatCop, formatTopUpOption } from '../utils/adminPlan'

export default function JarvisCommercialSummary({ plan, topUps, showDocumentCapacity = false }: { plan: AdminPlan; topUps: AdminJarvisTopUp[]; showDocumentCapacity?: boolean }) {
  if (!plan.commercialTerms) return null
  return <div className="admin-form__field admin-form__field--wide" role="status" aria-label="Valor del plan y las recargas">
    <span>Plan: {formatAdminPlanPrice(plan)}</span>
    {topUps.map(item => <span key={item.code}>{formatTopUpOption(item)} · pago único</span>)}
    {showDocumentCapacity && plan.commercialTerms.modules.includes('BILLING') && <>
      <span>Documentos de recargas: {topUps.filter(item => item.kind === 'DOCUMENTS').reduce((sum, item) => sum + item.units, 0)}</span>
      <strong>Cupo total: {plan.documentLimit === null ? 'Sin límite' : `${plan.documentLimit + topUps.filter(item => item.kind === 'DOCUMENTS').reduce((sum, item) => sum + item.units, 0)} documentos`}</strong>
    </>}
    <strong>Total: {formatCop(commercialSelectionTotal(plan, topUps))}</strong>
  </div>
}
