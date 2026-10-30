import { expect, it } from 'vitest'
import { jarvisBackDestination } from './jarvisBackNavigation'

it('vuelve por el historial creado dentro del panel', () => {
  expect(jarvisBackDestination('/nomina/empleados', 4, 2)).toBe(-1)
})
it.each([
  ['/nomina/nueva', '/nomina'],
  ['/nomina/empleados', '/nomina'],
  ['/factura-venta/123/visualizar', '/factura-venta'],
  ['/documento-soporte/nuevo', '/documento-soporte'],
  ['/productos/listar', '/inicio'],
  ['/configuracion/integracion-jarvis', '/inicio'],
  ['/inicio', '/inicio'],
])('ofrece regreso dentro de JARVIS al abrir directamente %s', (pathname, destination) => {
  expect(jarvisBackDestination(pathname, 3, 3)).toBe(destination)
})
