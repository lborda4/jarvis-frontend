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
  { documents: 10, amount: 25000, price: '$25.000' },
  { documents: 25, amount: 45000, price: '$45.000' },
  { documents: 50, amount: 80000, price: '$80.000' },
  { documents: 100, amount: 149900, price: '$149.900' },
  { documents: 250, amount: 300000, price: '$300.000' },
  { documents: 500, amount: 480000, price: '$480.000' },
]

// Precios por venta de la hoja «Productos» de Modelo_costos_punto_equilibrio_JENIUS_actualizado.xlsx. Facturación, nómina y combos se cobran anualmente.
export const BILLING_PLANS = [
  { name: 'Inscripción inicial de facturación', price: '$139.900', amount: 139900, documents: 50, capacity: '50 documentos de obsequio', description: 'El obsequio de 50 documentos aplica únicamente en la primera inscripción.', action: 'Quiero empezar a facturar' },
  { name: 'Inscripción regular de facturación', price: '$139.900', amount: 139900, documents: 25, capacity: '25 documentos incluidos', description: 'Para quienes ya realizaron su primera inscripción.', action: 'Consultar inscripción regular' },
] as const

export const PAYROLL_PLAN = { name: 'Nómina electrónica básica', price: '$129.900', amount: 129900, employees: 2, capacity: 'Hasta 2 empleados' } as const

export const COMPLIANCE_COMBOS = [
  { name: 'Combo cumplimiento inicial', price: '$230.000', amount: 230000, capacity: '50 documentos + nómina para 2 empleados', description: 'Combina la inscripción inicial de facturación con nómina electrónica básica.', features: ['50 documentos en la primera inscripción', 'Nómina para hasta 2 empleados', 'RADIAN incluido', 'Permite recargas de documentos y empleados'] },
  { name: 'Combo cumplimiento ilimitado', price: '$720.000', amount: 720000, capacity: 'Facturación y nómina ilimitadas', description: 'Una solución para facturar y enviar la nómina de todo tu equipo.', features: ['Facturación electrónica ilimitada', 'Nómina electrónica ilimitada', 'RADIAN incluido', 'Sin necesidad de recargas'] },
] as const

export const PAYROLL_TOP_UPS = [
  { employees: 1, amount: 20000, price: '$20.000' },
  { employees: 2, amount: 38000, price: '$38.000' },
  { employees: 3, amount: 55000, price: '$55.000' },
  { employees: 4, amount: 72000, price: '$72.000' },
  { employees: 5, amount: 88000, price: '$88.000' },
  { employees: 6, amount: 104000, price: '$104.000' },
  { employees: 7, amount: 119000, price: '$119.000' },
  { employees: 8, amount: 134000, price: '$134.000' },
  { employees: 9, amount: 148000, price: '$148.000' },
  { employees: 10, amount: 162000, price: '$162.000' },
  { employees: 11, amount: 175000, price: '$175.000' },
  { employees: 15, amount: 225000, price: '$225.000' },
  { employees: 20, amount: 290000, price: '$290.000' },
  { employees: 30, amount: 405000, price: '$405.000' },
] as const
