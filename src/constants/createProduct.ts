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

export const TAX_CLASSIFICATION = {
  TAXED: 'taxed',
  EXEMPT: 'exempt',
  EXCLUDED: 'excluded',
} as const

export type TaxClassification =
  (typeof TAX_CLASSIFICATION)[keyof typeof TAX_CLASSIFICATION]

export const TAX_CLASSIFICATION_OPTIONS: Array<{
  value: TaxClassification
  label: string
}> = [
  { value: TAX_CLASSIFICATION.TAXED, label: 'Gravado' },
  { value: TAX_CLASSIFICATION.EXEMPT, label: 'Exento' },
  { value: TAX_CLASSIFICATION.EXCLUDED, label: 'Excluido' },
]

export const IVA_RATE_OPTIONS = [
  { value: '19', label: '19 %' },
  { value: '5', label: '5 %' },
  { value: '0', label: '0 %' },
] as const

export const RETEFUENTE_CONCEPT_OPTIONS = [
  'Compras',
  'Honorarios',
  'Servicios',
  'Arrendamientos',
] as const

export const RETEICA_MUNICIPALITY_OPTIONS = [
  'Bogotá D.C.',
  'Medellín',
  'Cali',
  'Barranquilla',
  'Bucaramanga',
] as const

export const PRODUCT_DESCRIPTION_MAX_LENGTH = 500

export const CREATE_PRODUCT_STEPS = [
  {
    id: 1,
    label: 'Información principal',
    description: 'Completa los datos básicos del producto.',
  },
  {
    id: 2,
    label: 'Precios de venta',
    description: 'Configura las listas de precios.',
  },
  {
    id: 3,
    label: 'Impuestos',
    description: 'Define el tratamiento del IVA.',
  },
  {
    id: 4,
    label: 'Retenciones',
    description: 'Configura las retenciones (opcional).',
  },
] as const

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
