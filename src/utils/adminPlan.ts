import { INTEGRATION_PROVIDER, type AdminJarvisTopUp, type AdminPlan, type CreateAdminCompanyRequest } from '../types/admin'

export function isJarvisPortfolioPlan(plan: AdminPlan): boolean {
  return plan.provider === INTEGRATION_PROVIDER.JARVIS && plan.commercialTerms != null
}

export function formatAdminPlanPrice(plan: AdminPlan): string {
  const terms = plan.commercialTerms
  if (!terms) return ''
  const period = terms.billingMonths === 12 ? 'año' : terms.billingMonths === 1 ? 'mes' : `${terms.billingMonths} meses`
  return `$${terms.priceCop.toLocaleString('es-CO')} COP / ${period}`
}

export function formatAdminPlanCapacity(plan: AdminPlan): string {
  const terms = plan.commercialTerms
  if (!terms) return plan.documentLimit == null ? 'Sin límite de documentos' : `${plan.documentLimit} documentos`
  return [
    terms.modules.includes('BILLING') ? plan.documentLimit == null ? 'Documentos ilimitados' : `${plan.documentLimit} documentos` : '',
    terms.modules.includes('PAYROLL') ? terms.employeeLimit == null ? 'Nómina ilimitada' : `Nómina para ${terms.employeeLimit} empleados` : '',
  ].filter(Boolean).join(' · ')
}

export function formatAdminPlanOption(plan: AdminPlan): string {
  return [plan.name, formatAdminPlanPrice(plan), formatAdminPlanCapacity(plan)].filter(Boolean).join(' · ')
}

export function jarvisPlanAssignment(plan: AdminPlan): Pick<CreateAdminCompanyRequest, 'jarvisPlanId' | 'jarvisModules' | 'billingMonths'> {
  if (!isJarvisPortfolioPlan(plan)) throw new Error('Selecciona un plan Jarvis del portafolio.')
  return { jarvisPlanId: plan.id, jarvisModules: [...plan.commercialTerms!.modules], billingMonths: plan.commercialTerms!.billingMonths }
}

export const formatCop = (amount: number) => `$${amount.toLocaleString('es-CO')} COP`
export const formatTopUpOption = (item: AdminJarvisTopUp) => `${item.name} · ${formatCop(item.priceCop)}`

export function isTopUpCompatible(plan: AdminPlan | null | undefined, item: AdminJarvisTopUp): boolean {
  const terms = plan?.commercialTerms
  if (!terms) return false
  return item.kind === 'DOCUMENTS'
    ? terms.modules.includes('BILLING') && plan!.documentLimit !== null
    : terms.modules.includes('PAYROLL') && terms.employeeLimit !== null
}

export function compatibleTopUpCodes(plan: AdminPlan | null | undefined, codes: string[], catalog: AdminJarvisTopUp[]): string[] {
  return catalog.filter(item => codes.includes(item.code) && isTopUpCompatible(plan, item)).map(item => item.code)
}

export function commercialSelectionTotal(plan: AdminPlan, topUps: AdminJarvisTopUp[]): number {
  return (plan.commercialTerms?.priceCop ?? 0) + topUps.reduce((sum, item) => sum + item.priceCop, 0)
}
