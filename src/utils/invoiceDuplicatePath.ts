export function invoiceDuplicatePath(invoiceId: string, supportDocument = false): string {
  const path = supportDocument ? '/documento-soporte/nuevo' : '/factura-venta/nueva'
  return `${path}?duplicar=${encodeURIComponent(invoiceId)}`
}
