import type { ProductResponse } from '../services/productService'
import { productIvaRate } from './productTaxes'

export interface SalesInvoicePriceOption {
  id: string
  name: string
  unitValue: string
}

export function getSalesInvoicePrices(product: ProductResponse): SalesInvoicePriceOption[] {
  const ivaRate = productIvaRate(product)
  return [...(product.priceLists ?? [])]
    .filter((list) => list.enabled)
    .sort((a, b) => a.position - b.position)
    .map((list) => ({
      id: list.id,
      name: list.name || `Precio ${list.position}`,
      unitValue: String(product.priceIncludesIva && ivaRate
        ? Math.round((list.price / (1 + ivaRate / 100)) * 100) / 100
        : list.price),
    }))
}
