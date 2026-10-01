export interface PaymentEntry {
  id: string
  methodId: string
  amount: string
  automatic?: boolean
}

export function balancePayments(entries: PaymentEntry[], total: number): PaymentEntry[] {
  const cents = (value: number) => Math.round(value * 100)
  const manual = entries.filter(entry => !entry.automatic)
  const paid = manual.reduce((sum, entry) => sum + cents(Number(entry.amount) || 0), 0)
  const remaining = Math.max(0, cents(total) - paid) / 100
  const automatic = entries.find(entry => entry.automatic)
  if (manual.length && remaining === 0) return manual
  return [...manual, {
    ...(automatic ?? { id: `${manual.at(-1)?.id ?? 'payment'}-remainder`, methodId: '', automatic: true }),
    amount: remaining.toFixed(2),
  }]
}
