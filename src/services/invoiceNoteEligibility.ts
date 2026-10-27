import { fetchJarvisInvoiceDetail } from './jarvisService'
import { fetchRadianHistory } from './radianService'

export async function invoiceNoteBlockReason(invoiceId: string): Promise<string | null> {
  const invoice = await fetchJarvisInvoiceDetail(invoiceId)
  if (!invoice.cufe?.trim()) throw new Error('La factura no tiene CUFE para consultar RADIAN.')
  const events = await fetchRadianHistory(invoice.cufe.trim())
  if (events.some(event => event.eventId === 4 && event.status === 'sent')) {
    return 'Esta factura ya tiene aceptación en RADIAN. No se le puede hacer nota crédito ni nota débito.'
  }
  if (events.some(event => event.eventId === 4 && event.status === 'unknown')) {
    return 'La aceptación en RADIAN de esta factura está por confirmar. Verifica su estado antes de crear una nota crédito o débito.'
  }
  return null
}
