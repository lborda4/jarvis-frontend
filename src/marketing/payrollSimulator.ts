import { COMPLIANCE_COMBOS, PAYROLL_PLAN, PAYROLL_TOP_UPS } from './catalog'

export type PayrollPlanSelection = 'basic' | 'unlimited'
export interface PayrollEstimate {
  employees: number
  planName: string
  planAmount: number
  includedEmployees: number | null
  packs: { employees: number; quantity: number; amount: number }[]
  capacity: number | null
  totalAmount: number
  unlimited: boolean
}

export function buildManualPayrollPlan(plan: PayrollPlanSelection, quantities: Record<number, number>): PayrollEstimate | null {
  if (plan === 'unlimited') {
    const combo = COMPLIANCE_COMBOS[1]
    return { employees: 0, planName: combo.name, planAmount: combo.amount, includedEmployees: null,
      packs: [], capacity: null, totalAmount: combo.amount, unlimited: true }
  }
  const packs: PayrollEstimate['packs'] = []
  for (const pack of PAYROLL_TOP_UPS) {
    const quantity = quantities[pack.employees] ?? 0
    if (!Number.isSafeInteger(quantity) || quantity < 0 || quantity > 10_000) return null
    if (quantity) packs.push({ employees: pack.employees, amount: pack.amount, quantity })
  }
  const capacity = PAYROLL_PLAN.employees + packs.reduce((sum, pack) => sum + pack.employees * pack.quantity, 0)
  return { employees: capacity, planName: PAYROLL_PLAN.name, planAmount: PAYROLL_PLAN.amount,
    includedEmployees: PAYROLL_PLAN.employees, packs, capacity,
    totalAmount: PAYROLL_PLAN.amount + packs.reduce((sum, pack) => sum + pack.amount * pack.quantity, 0), unlimited: false }
}

/** Employee slots last for the annual subscription; do not multiply headcount by twelve. */
export function estimatePayrollPlan(employees: number): PayrollEstimate | null {
  if (!Number.isSafeInteger(employees) || employees < 1 || employees > 1_000_000_000) return null
  const base = buildManualPayrollPlan('basic', {})!
  const unlimited = { ...buildManualPayrollPlan('unlimited', {})!, employees }
  const needed = Math.max(0, employees - PAYROLL_PLAN.employees)
  if (!needed) return { ...base, employees }
  const bestUnitPrice = Math.min(...PAYROLL_TOP_UPS.map(pack => pack.amount / pack.employees))
  if (needed * bestUnitPrice > unlimited.totalAmount - base.totalAmount) return unlimited
  const limit = needed + Math.max(...PAYROLL_TOP_UPS.map(pack => pack.employees)) - 1
  const costs = new Float64Array(limit + 1).fill(Infinity)
  const counts = new Int32Array(limit + 1).fill(2_147_483_647)
  const previous = new Int32Array(limit + 1).fill(-1)
  costs[0] = 0; counts[0] = 0
  for (let count = 1; count <= limit; count++) {
    PAYROLL_TOP_UPS.forEach((pack, index) => {
      const before = count - pack.employees
      if (before < 0) return
      const cost = costs[before] + pack.amount
      if (cost < costs[count] || (cost === costs[count] && counts[before] + 1 < counts[count])) {
        costs[count] = cost; counts[count] = counts[before] + 1; previous[count] = index
      }
    })
  }
  let coverage = needed
  for (let count = needed; count <= limit; count++) {
    if (costs[count] < costs[coverage] || (costs[count] === costs[coverage] && counts[count] < counts[coverage])) coverage = count
  }
  if (base.totalAmount + costs[coverage] > unlimited.totalAmount) return unlimited
  const quantities: Record<number, number> = {}
  for (let remaining = coverage; remaining > 0;) {
    const pack = PAYROLL_TOP_UPS[previous[remaining]]
    if (!pack) return unlimited
    quantities[pack.employees] = (quantities[pack.employees] ?? 0) + 1
    remaining -= pack.employees
  }
  return { ...buildManualPayrollPlan('basic', quantities)!, employees }
}

export function payrollEstimateMessage(estimate: PayrollEstimate, manual: boolean): string {
  return `Hola, armé mi plan de nómina electrónica en Jarvis. ${manual ? 'Elegí el plan y las recargas manualmente.' : `Tengo ${estimate.employees.toLocaleString('es-CO')} empleados.`} Plan: ${estimate.planName}. ${estimate.packs.length ? 'Recargas: ' + estimate.packs.map(pack => `${pack.quantity} × ${pack.employees} empleados`).join(', ') + '. ' : ''}Cupo: ${estimate.capacity === null ? 'nómina y facturación ilimitadas' : estimate.capacity.toLocaleString('es-CO') + ' empleados'}. Total anual estimado: $${estimate.totalAmount.toLocaleString('es-CO')} COP. Quiero asesoría para contratarlo.`
}
