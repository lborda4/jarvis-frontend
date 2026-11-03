import { expect, it } from 'vitest'
import { jarvisBackDestination, shouldShowJarvisBackNavigation } from './jarvisBackNavigation'

it.each([
  '/nomina', '/nomina/empleados', '/nomina/configuracion',
  '/factura-venta', '/factura-compra', '/documento-soporte',
  '/productos/listar', '/terceros', '/reportes',
  '/formas-de-pago', '/configuracion/integracion-jarvis',
  '/extractos-bancarios/cargar',
])('oculta Atrás en la página principal %s', pathname => {
  expect(shouldShowJarvisBackNavigation(pathname)).toBe(false)
})

it.each([
  '/nomina/nueva', '/factura-venta/nueva', '/factura-venta/123/visualizar',
  '/documento-soporte/nuevo', '/documento-soporte/importar', '/terceros/123/editar',
])('muestra Atrás en el formulario o detalle %s', pathname => {
  expect(shouldShowJarvisBackNavigation(pathname)).toBe(true)
})

it('muestra Atrás al abrir un formulario interno y lo oculta al volver al listado', () => {
  expect(shouldShowJarvisBackNavigation('/nomina/empleados', true)).toBe(true)
  expect(shouldShowJarvisBackNavigation('/nomina/empleados', false)).toBe(false)
})

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
