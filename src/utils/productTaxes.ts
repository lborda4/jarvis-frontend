import type { JarvisTax } from '../types/jarvis'
import type { ProductResponse, ProductTax } from '../services/productService'

/** El producto no guarda banderas de IVA ni de retefuente: sus impuestos llegan
 * como filas de jarvis_taxes (nombre, tipo y tarifa), así que se reconocen por
 * la etiqueta para preseleccionar el impuesto de la línea del documento. */
export function findProductIvaTax(
  product: ProductResponse,
): ProductTax | undefined {
  return (product.taxes ?? []).find((tax) => {
    const label = `${tax.name ?? ''} ${tax.tax_type ?? ''}`.toUpperCase()
    return label.includes('IVA') && !label.includes('RETE')
  })
}

export function findProductRetefuenteTax(
  product: ProductResponse,
): ProductTax | undefined {
  return (product.taxes ?? []).find((tax) => {
    const label = `${tax.name ?? ''} ${tax.tax_type ?? ''}`.toUpperCase()
    if (label.includes('ICA') || label.includes('IVA')) return false
    return label.includes('RETE') || label.includes('RENTA')
  })
}

/** Tarifa de IVA del producto, o null si no tiene IVA configurado. */
export function productIvaRate(product: ProductResponse): number | null {
  return findProductIvaTax(product)?.rate ?? null
}

export type ProductTaxOption = Pick<JarvisTax, 'id' | 'category' | 'code' | 'name' | 'tax_type' | 'rate'>
export const DEFAULT_PRODUCT_IVA_ID = 'default:iva19'
export const DEFAULT_PRODUCT_IVA: ProductTaxOption = {
  id: DEFAULT_PRODUCT_IVA_ID, category: 'IMPUESTO', code: 'Predeterminado',
  name: 'IVA', tax_type: 'IVA', rate: 19,
}

export function isDefaultProductIva(tax: ProductTaxOption): boolean {
  return tax.category === 'IMPUESTO' && tax.tax_type.trim().toUpperCase() === 'IVA' && tax.rate === 19
}

export function buildProductTaxOptions(taxes: JarvisTax[], selectedIds: string[] = []): ProductTaxOption[] {
  const visible = taxes.filter(tax => tax.is_active || selectedIds.includes(tax.id))
  return taxes.some(tax => tax.is_active && isDefaultProductIva(tax))
    ? visible : [...visible, DEFAULT_PRODUCT_IVA]
}
