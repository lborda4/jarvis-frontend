export function shouldShowJarvisBackNavigation(pathname: string, hasInternalView = false): boolean {
  if (hasInternalView) return true
  return /\/(?:nueva|nuevo|crear|editar|visualizar|importar|masivo)(?:\/|$)/.test(pathname)
}

export function jarvisBackDestination(pathname: string, currentIndex: number, entryIndex: number): string | -1 {
  // Solo recorrer el historial creado dentro de este panel, sin volver al login.
  if (currentIndex > entryIndex) return -1
  const modules = ['/nomina', '/documento-soporte', '/factura-venta', '/factura-compra', '/nota-credito', '/nota-debito', '/nota-ajuste', '/productos/listar', '/terceros', '/reportes']
  return modules.find(module => pathname.startsWith(`${module}/`)) ?? '/inicio'
}
