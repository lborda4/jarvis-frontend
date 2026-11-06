export const JARVIS_MODULES = ['BILLING', 'PAYROLL'] as const
export type JarvisModule = (typeof JARVIS_MODULES)[number]
export const JARVIS_MODULE_LABELS: Record<JarvisModule, string> = {
  BILLING: 'Facturación',
  PAYROLL: 'Nómina',
}

// Existing companies retain both modules until an administrator changes their selection.
export function companyJarvisModules(modules?: JarvisModule[] | null): JarvisModule[] {
  return modules == null ? [...JARVIS_MODULES] : modules
}

export function jarvisModuleForPath(path: string): JarvisModule | null {
  if (/^\/nomina(?:\/|$)/.test(path)) return 'PAYROLL'
  if (/^\/(?:factura-venta|factura-compra|documento-soporte|nota-credito|nota-debito|nota-ajuste|eventos-radian|reportes|productos|terceros|formas-de-pago|impuestos-retenciones)(?:\/|$)/.test(path)) return 'BILLING'
  return null
}
