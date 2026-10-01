import type { SupplierOption } from '../types/supplier'

function normalizeName(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

/** Conserva el NIT base; solo retira el DV cuando viene separado por guion. */
function normalizeNit(value: string): string | null {
  const text = value.trim().replace(/^nit\s*:?[\s]*/i, '')
  if (!/^\d[\d.\s]*(?:\s*-\s*\d)?$/.test(text)) return null
  return text.replace(/-\s*\d$/, '').replace(/[.\s]/g, '')
}

export function filterSuppliers(options: SupplierOption[], search: string): SupplierOption[] {
  const query = search.trim()
  if (!query) return options

  const nit = normalizeNit(query)
  if (nit) {
    const exact = options.filter(supplier => normalizeNit(supplier.nit) === nit)
    if (exact.length) return exact
    // Mientras se escribe, buscar solo en el NIT, nunca en el nombre.
    return options.filter(supplier => normalizeNit(supplier.nit)?.startsWith(nit))
  }

  const name = normalizeName(query)
  return options.filter(supplier => normalizeName(supplier.name).includes(name))
}
