import type { RadianInvoice } from './radianExcel'

export function mergeRadianInvoices(existing: RadianInvoice[], incoming: RadianInvoice[]) {
  const seen = new Set(existing.filter(row => row.cufe).map(row => row.cufe.trim().toLowerCase()))
  const added: RadianInvoice[] = []
  const repeated: RadianInvoice[] = []
  for (const invoice of incoming) {
    const cufe = invoice.cufe.trim().toLowerCase()
    if (cufe && seen.has(cufe)) { repeated.push(invoice); continue }
    if (cufe) seen.add(cufe)
    added.push({ ...invoice, cufe })
  }
  return { invoices: [...existing, ...added], added, repeated }
}
