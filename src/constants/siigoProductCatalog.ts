export interface SiigoProductOption {
  code: string
  description: string
}

export function formatProductOptionLabel(product: SiigoProductOption): string {
  return `${product.code} - ${product.description}`
}
