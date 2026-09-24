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
