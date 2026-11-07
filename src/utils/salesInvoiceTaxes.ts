import type { JarvisCatalogItem } from '../services/jarvisService'
import type { JarvisTax, JarvisTaxCategory } from '../types/jarvis'
import { JARVIS_TAX_RATES, normalizeJarvisTaxType, stripReteIcaThousandSuffix, taxPresetLabel } from './jarvisTaxPresets'

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
  return normalizeJarvisTaxType(value)
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
  const defaults: SalesInvoiceTaxOption[] = Object.entries(JARVIS_TAX_RATES).flatMap(([type, rates]) => {
    const normalized = normalizeTaxType(type)
    const master = catalogTaxes.find(item => [item.name, item.type, item.code].some(value => value && normalizeTaxType(value) === normalized))
    // Only offer types supported by the master catalog; IVA has an established ID.
    const catalogId = master?.id ?? (normalized === 'iva' ? 1 : null)
    if (catalogId === null) return []
    return rates.filter(rate => !saved.some(tax => normalizeTaxType(tax.type) === normalized && tax.percentage === rate)).map(rate => ({
      id: `default:${normalized}${rate}`, name: type, type, percentage: rate,
      category: normalized.startsWith('rete') ? 'RETENCION' : 'IMPUESTO', catalogId,
    }))
  })
  return [...saved, ...defaults]
}

export function formatSalesInvoiceTaxLabel(tax: SalesInvoiceTaxOption): string {
  if (tax.percentage == null) return stripReteIcaThousandSuffix(tax.name)
  const preset = taxPresetLabel(tax.type, tax.percentage)
  const cleanedName = stripReteIcaThousandSuffix(tax.name)
  if (cleanedName === preset || tax.name === preset) return cleanedName
  if (tax.id.startsWith('default:')) return preset
  if (tax.type.toLowerCase() === 'reteica') return `${cleanedName} · ${tax.percentage}`
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
