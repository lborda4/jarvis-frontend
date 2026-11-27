export interface PurchaseOrder {
  prefix: string
  consecutive: string
  issueDate: string
}

export function purchaseOrderNumber(order: Pick<PurchaseOrder, 'prefix' | 'consecutive'>): string | null {
  const prefix = order.prefix.trim().replace(/[-\s]+$/, '')
  const consecutive = order.consecutive.trim().replace(/^[-\s]+/, '')
  return prefix && consecutive ? `${prefix}-${consecutive}` : null
}

export function isValidPurchaseOrder(order: PurchaseOrder): boolean {
  if (!order.prefix.trim() && !order.consecutive.trim() && !order.issueDate.trim()) return true
  const date = order.issueDate.trim()
  return Boolean(purchaseOrderNumber(order) &&
    /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) &&
    new Date(date).toISOString().slice(0, 10) === date)
}
