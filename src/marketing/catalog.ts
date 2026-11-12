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
  { name: 'Inicial', price: '$35.000', amount: 35000, period: '/mes', limit: 'Hasta 100 documentos', tone: 'teal' },
  { name: 'Profesional', price: '$75.000', amount: 75000, period: '/mes', limit: 'Hasta 500 documentos', tone: 'blue' },
  { name: 'Avanzado', price: '$120.000', amount: 120000, period: '/mes', limit: 'Hasta 1.000 documentos', tone: 'green' },
  { name: 'Empresarial', price: '$250.000', amount: 250000, period: '/mes', limit: 'Hasta 5.000 documentos', tone: 'purple' },
  { name: 'Corporativo', price: 'Cotizar', amount: null, period: '', limit: 'Más de 5.000 documentos', tone: 'dark' },
]

export const BILLING_TOP_UPS = [
  { documents: 10, price: '$25.000' },
  { documents: 25, price: '$45.000' },
  { documents: 50, price: '$80.000' },
  { documents: 100, price: '$140.000' },
  { documents: 250, price: '$300.000' },
  { documents: 500, price: '$480.000' },
]

// Importes del portafolio comercial. Facturación, nómina y combos se cobran anualmente.
export const BILLING_PLANS = [
  { name: 'Inscripción inicial de facturación', price: '$139.900', amount: 139900, capacity: '50 documentos de obsequio', description: 'El obsequio de 50 documentos aplica únicamente en la primera inscripción.', action: 'Quiero empezar a facturar' },
  { name: 'Inscripción regular de facturación', price: '$139.900', amount: 139900, capacity: '25 documentos incluidos', description: 'Para quienes ya realizaron su primera inscripción.', action: 'Consultar inscripción regular' },
] as const

export const PAYROLL_PLAN = { name: 'Nómina electrónica básica', price: '$149.900', amount: 149900, capacity: 'Hasta 2 empleados' } as const

export const COMPLIANCE_COMBOS = [
  { name: 'Combo cumplimiento inicial', price: '$220.000', amount: 220000, capacity: '50 documentos + nómina para 2 empleados', description: 'Combina la inscripción inicial de facturación con nómina electrónica básica.', features: ['50 documentos en la primera inscripción', 'Nómina para hasta 2 empleados', 'RADIAN incluido', 'Permite recargas de documentos y empleados'] },
  { name: 'Combo cumplimiento ilimitado', price: '$720.000', amount: 720000, capacity: 'Facturación y nómina ilimitadas', description: 'Una solución para facturar y enviar la nómina de todo tu equipo.', features: ['Facturación electrónica ilimitada', 'Nómina electrónica ilimitada', 'RADIAN incluido', 'Sin necesidad de recargas'] },
] as const

export const PAYROLL_TOP_UPS = [
  { employees: 1, price: '$20.000' },
  { employees: 2, price: '$38.000' },
  { employees: 3, price: '$55.000' },
  { employees: 5, price: '$90.000' },
  { employees: 10, price: '$170.000' },
  { employees: 20, price: '$320.000' },
] as const
