import { COMPLIANCE_COMBOS } from './catalog'
import { buildManualBillingPlan, estimateBillingPlan, type BillingEstimate, type BillingFrequency } from './billingSimulator'
import { buildManualPayrollPlan, estimatePayrollPlan, type PayrollEstimate, type PayrollPlanSelection } from './payrollSimulator'

export interface ComboEstimate {
  planName: string
  planAmount: number
  billingPacks: BillingEstimate['packs']
  payrollPacks: PayrollEstimate['packs']
  documents: number | null
  employees: number | null
  totalAmount: number
  unlimited: boolean
}

export function buildManualComboPlan(plan: PayrollPlanSelection, documents: Record<number, number>, employees: Record<number, number>): ComboEstimate | null {
  const combo = COMPLIANCE_COMBOS[plan === 'unlimited' ? 1 : 0]
  if (plan === 'unlimited') return { planName: combo.name, planAmount: combo.amount, billingPacks: [], payrollPacks: [], documents: null, employees: null, totalAmount: combo.amount, unlimited: true }
  const billing = buildManualBillingPlan('initial', documents)
  const payroll = buildManualPayrollPlan('basic', employees)
  if (!billing || !payroll) return null
  return { planName: combo.name, planAmount: combo.amount, billingPacks: billing.packs, payrollPacks: payroll.packs,
    documents: billing.capacity, employees: payroll.capacity,
    totalAmount: combo.amount + (billing.totalAmount - billing.planAmount) + (payroll.totalAmount - payroll.planAmount), unlimited: false }
}

export function estimateComboPlan(quantity: number, frequency: BillingFrequency, employees: number): ComboEstimate | null {
  const billing = estimateBillingPlan(quantity, frequency, 'initial')
  const payroll = estimatePayrollPlan(employees)
  if (!billing || !payroll) return null
  const unlimited = buildManualComboPlan('unlimited', {}, {})!
  if (billing.unlimited || payroll.unlimited) return unlimited
  const combined = buildManualComboPlan('basic', Object.fromEntries(billing.packs.map(pack => [pack.documents, pack.quantity])), Object.fromEntries(payroll.packs.map(pack => [pack.employees, pack.quantity])))!
  return combined.totalAmount > unlimited.totalAmount ? unlimited : combined
}

export function comboEstimateMessage(estimate: ComboEstimate): string {
  const recargas = [...estimate.billingPacks.map(pack => `${pack.quantity} × ${pack.documents} documentos`), ...estimate.payrollPacks.map(pack => `${pack.quantity} × ${pack.employees} empleados`)]
  return `Hola, armé mi plan de facturación y nómina electrónica en Jarvis. Plan: ${estimate.planName}. ${recargas.length ? 'Recargas: ' + recargas.join(', ') + '. ' : ''}Cupo: ${estimate.unlimited ? 'facturación y nómina ilimitadas' : `${estimate.documents?.toLocaleString('es-CO')} documentos y ${estimate.employees?.toLocaleString('es-CO')} empleados`}. Total anual estimado: $${estimate.totalAmount.toLocaleString('es-CO')} COP. Quiero asesoría para contratarlo.`
}
