import type { JarvisCatalogItem } from '../services/jarvisService'
import type { JarvisTax, JarvisTaxCategory } from '../types/jarvis'

export interface SalesInvoiceTaxOption {
  id: string
  name: string
  type: string
  percentage: number | null
  category: JarvisTaxCategory
  catalogId: number | null
  savedId?: string
}

export const DEFAULT_SALES_IVA: SalesInvoiceTaxOption = {
  id: 'default:iva19', name: 'IVA', type: 'IVA', percentage: 19,
  category: 'IMPUESTO', catalogId: 1,
}

function normalizeTaxType(value: string): string {
  const normalized = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]/g, '')
  return normalized === 'retefuente' ? 'reterenta' : normalized
}

export function buildSalesInvoiceTaxOptions(
  savedTaxes: JarvisTax[],
  catalogTaxes: JarvisCatalogItem[],
): SalesInvoiceTaxOption[] {
  const saved = savedTaxes.filter((tax) => tax.is_active).map((tax) => {
    const type = normalizeTaxType(tax.tax_type)
    const master = catalogTaxes.find((item) =>
      [item.name, item.type, item.code].some((value) => value && normalizeTaxType(value) === type),
    )
    return {
      id: `saved:${tax.id}`, savedId: tax.id, name: tax.name,
      type: tax.tax_type, percentage: tax.rate, category: tax.category,
      catalogId: master?.id ?? (type === 'iva' ? DEFAULT_SALES_IVA.catalogId : null),
    }
  })
  return saved
}

export function formatSalesInvoiceTaxLabel(tax: SalesInvoiceTaxOption): string {
  if (tax.percentage == null) return tax.name
  if (tax.type.toLowerCase() === 'reteica') return `${tax.name} · ${tax.percentage} x 1.000`
  if (tax.name.includes('%')) return `${tax.name} · tarifa ${tax.percentage}%`
  return `${tax.name} (${tax.percentage}%)`
}

export function calculateSalesInvoiceTax(base: number, selectedId: string, percentage: string): number {
  if (!selectedId) return 0
  const rate = Number(percentage.replace(',', '.'))
  return Number.isFinite(rate) ? Math.round(Math.max(0, base) * Math.max(0, rate)) / 100 : 0
}

export function requireSalesInvoiceTaxCatalogId(tax: SalesInvoiceTaxOption): number {
  if (tax.catalogId == null) {
    throw new Error(`El tipo de impuesto "${tax.type}" de "${tax.name}" no coincide con el catálogo de facturación. Revise su configuración.`)
  }
  return tax.catalogId
}
