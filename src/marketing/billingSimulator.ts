import { BILLING_PLANS, BILLING_TOP_UPS, COMPLIANCE_COMBOS } from './catalog'

export type BillingFrequency = 'month' | 'year'
export type BillingRegistration = 'initial' | 'regular'
export interface BillingEstimate {
  annualDocuments: number
  planName: string
  planAmount: number
  includedDocuments: number | null
  packs: { documents: number; quantity: number; amount: number }[]
  capacity: number | null
  totalAmount: number
  unlimited: boolean
}

/** Cheapest coverage from the published packs. Surplus is allowed; packs can be bought during the subscription. */
export function estimateBillingPlan(quantity: number, frequency: BillingFrequency, registration: BillingRegistration): BillingEstimate | null {
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1_000_000_000) return null
  const annualDocuments = frequency === 'month' ? quantity * 12 : quantity
  const plan = BILLING_PLANS[registration === 'initial' ? 0 : 1]
  const unlimitedPlan = COMPLIANCE_COMBOS[1]
  const unlimited: BillingEstimate = { annualDocuments, planName: unlimitedPlan.name, planAmount: unlimitedPlan.amount, includedDocuments: null, packs: [], capacity: null, totalAmount: unlimitedPlan.amount, unlimited: true }
  const base: BillingEstimate = { annualDocuments, planName: plan.name, planAmount: plan.amount, includedDocuments: plan.documents, packs: [], capacity: plan.documents, totalAmount: plan.amount, unlimited: false }
  const needed = Math.max(0, annualDocuments - plan.documents)
  if (!needed) return base
  // A lower bound avoids a huge dynamic program for large volumes without approximating the result.
  const bestUnitPrice = Math.min(...BILLING_TOP_UPS.map(pack => pack.amount / pack.documents))
  if (needed * bestUnitPrice > unlimitedPlan.amount - plan.amount) return unlimited
  const maxPack = Math.max(...BILLING_TOP_UPS.map(pack => pack.documents))
  const limit = needed + maxPack - 1
  const costs = new Float64Array(limit + 1).fill(Infinity)
  const counts = new Int32Array(limit + 1).fill(2_147_483_647)
  const previous = new Int32Array(limit + 1).fill(-1)
  costs[0] = 0; counts[0] = 0
  for (let documents = 1; documents <= limit; documents++) {
    BILLING_TOP_UPS.forEach((pack, index) => {
      if (documents < pack.documents) return
      const before = documents - pack.documents
      const cost = costs[before] + pack.amount
      if (cost < costs[documents] || (cost === costs[documents] && counts[before] + 1 < counts[documents])) {
        costs[documents] = cost; counts[documents] = counts[before] + 1; previous[documents] = index
      }
    })
  }
  let coverage = needed
  for (let documents = needed; documents <= limit; documents++) {
    if (costs[documents] < costs[coverage] || (costs[documents] === costs[coverage] && counts[documents] < counts[coverage])) coverage = documents
  }
  if (plan.amount + costs[coverage] > unlimitedPlan.amount) return unlimited
  const quantities = new Map<number, number>()
  for (let remaining = coverage; remaining > 0;) {
    const index = previous[remaining]
    if (index < 0) return unlimited
    quantities.set(index, (quantities.get(index) ?? 0) + 1)
    remaining -= BILLING_TOP_UPS[index].documents
  }
  return { ...base, capacity: plan.documents + coverage, totalAmount: plan.amount + costs[coverage], packs: [...quantities].map(([index, amount]) => ({ documents: BILLING_TOP_UPS[index].documents, quantity: amount, amount: BILLING_TOP_UPS[index].amount })).sort((a, b) => b.documents - a.documents) }
}

export function buildManualBillingPlan(registration: BillingRegistration, quantities: Record<number, number>): BillingEstimate | null {
  const plan = BILLING_PLANS[registration === 'initial' ? 0 : 1]
  const packs: BillingEstimate['packs'] = []
  for (const pack of BILLING_TOP_UPS) {
    const quantity = quantities[pack.documents] ?? 0
    if (!Number.isSafeInteger(quantity) || quantity < 0 || quantity > 10_000) return null
    if (quantity) packs.push({ documents: pack.documents, amount: pack.amount, quantity })
  }
  const capacity = plan.documents + packs.reduce((sum, pack) => sum + pack.documents * pack.quantity, 0)
  return { annualDocuments: capacity, planName: plan.name, planAmount: plan.amount,
    includedDocuments: plan.documents, packs, capacity,
    totalAmount: plan.amount + packs.reduce((sum, pack) => sum + pack.amount * pack.quantity, 0), unlimited: false }
}

export function billingEstimateMessage(estimate: BillingEstimate, quantity: number, frequency: BillingFrequency, manual = false): string {
  const money = (amount: number) => `$${amount.toLocaleString('es-CO')} COP`
  const volume = manual ? 'Elegí las recargas manualmente.' : `Emito ${quantity.toLocaleString('es-CO')} facturas ${frequency === 'month' ? 'al mes' : 'al año'} (${estimate.annualDocuments.toLocaleString('es-CO')} al año).`
  return `Hola, armé mi plan de facturación electrónica en Jarvis. ${volume} Plan: ${estimate.planName}. ${estimate.packs.length ? 'Recargas: ' + estimate.packs.map(pack => `${pack.quantity} × ${pack.documents} documentos`).join(', ') + '. ' : ''}Cupo: ${estimate.capacity === null ? 'ilimitado' : estimate.capacity.toLocaleString('es-CO') + ' documentos'}. Total anual estimado: ${money(estimate.totalAmount)}. Quiero asesoría para contratarlo.`
}
