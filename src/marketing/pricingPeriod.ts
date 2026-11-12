export type PricingPeriod = 'month' | 'year'

export function formatCop(amount: number) {
  return `$${Math.round(amount).toLocaleString('es-CO')}`
}

export function periodicPrice(amount: number, period: PricingPeriod, billed: PricingPeriod = 'year') {
  const annualAmount = billed === 'year' ? amount : amount * 12
  return {
    price: formatCop(period === 'year' ? annualAmount : annualAmount / 12),
    suffix: period === 'year' ? '/año' : '/mes',
    label: period === 'month' && billed === 'year' ? 'Equivalente mensual' : period === 'year' ? 'Valor anual' : 'Valor mensual',
    terms: billed === 'year'
      ? `Pago anual de ${formatCop(amount)} COP${period === 'month' ? ' · Equivalente mensual aproximado' : ''}`
      : period === 'year' ? `12 pagos mensuales de ${formatCop(amount)} COP` : `Pago mensual de ${formatCop(amount)} COP`,
  }
}
