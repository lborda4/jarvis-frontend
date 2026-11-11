export type Product = 'siigo' | 'billing'
export type MarketingProduct = Product | 'payroll'

export const PUBLIC_PATHS = ['/', '/siigo', '/facturacion-electronica', '/nomina-electronica'] as const
export type PublicPath = typeof PUBLIC_PATHS[number]

export function isPublicPath(path: string): path is PublicPath {
  return PUBLIC_PATHS.some(publicPath => publicPath === path)
}

export function productForPath(path: PublicPath): MarketingProduct | undefined {
  return path === '/siigo' ? 'siigo' : path === '/facturacion-electronica' ? 'billing' : path === '/nomina-electronica' ? 'payroll' : undefined
}

export const SIIGO_PLANS = [
  { name: 'Inicial', price: '$35.000', period: '/mes', limit: 'Hasta 100 documentos', tone: 'teal' },
  { name: 'Profesional', price: '$75.000', period: '/mes', limit: 'Hasta 500 documentos', tone: 'blue' },
  { name: 'Avanzado', price: '$120.000', period: '/mes', limit: 'Hasta 1.000 documentos', tone: 'green' },
  { name: 'Empresarial', price: '$250.000', period: '/mes', limit: 'Hasta 5.000 documentos', tone: 'purple' },
  { name: 'Corporativo', price: 'Cotizar', period: '', limit: 'Más de 5.000 documentos', tone: 'dark' },
]

export const BILLING_TOP_UPS = [
  { documents: 10, price: '$25.000' },
  { documents: 25, price: '$45.000' },
  { documents: 50, price: '$80.000' },
  { documents: 100, price: '$140.000' },
  { documents: 250, price: '$300.000' },
  { documents: 500, price: '$480.000' },
]
