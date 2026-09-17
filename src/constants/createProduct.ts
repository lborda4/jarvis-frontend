export const PRODUCT_KIND = {
  PRODUCT: 'product',
  SERVICE: 'service',
} as const

export type ProductKind = (typeof PRODUCT_KIND)[keyof typeof PRODUCT_KIND]

export const PRODUCT_KIND_OPTIONS: Array<{ value: ProductKind; label: string }> = [
  { value: PRODUCT_KIND.PRODUCT, label: 'Producto' },
  { value: PRODUCT_KIND.SERVICE, label: 'Servicio' },
]

export interface ProductCategory {
  /** Identificador (uuid) de la categoría en el backend. */
  id: string
  /** Nombre de la categoría (ej. "Ropa"). */
  name: string
}

export const PRODUCT_DESCRIPTION_MAX_LENGTH = 500

export function generateProductSku(): string {
  const suffix = String(Math.floor(1 + Math.random() * 999)).padStart(3, '0')
  return `PROD-${suffix}`
}

export function parseMoneyInput(value: string): number {
  const digits = value.replace(/[^\d]/g, '')
  if (!digits) return 0
  return Number(digits)
}

export function formatMoneyInput(value: string): string {
  const amount = parseMoneyInput(value)
  if (!value.replace(/[^\d]/g, '')) return ''
  return amount.toLocaleString('es-CO')
}
