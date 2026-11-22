import type { AdminAdvisor } from '../types/admin'
import { formatCop } from './adminPlan'

export function advisorCommissionLabel(advisor: Pick<AdminAdvisor, 'commissionType' | 'commissionValue'>) {
  if (advisor.commissionValue === null) return 'Sin definir'
  return advisor.commissionType === 'PERCENT' ? `${advisor.commissionValue.toLocaleString('es-CO')} %` : formatCop(advisor.commissionValue)
}
