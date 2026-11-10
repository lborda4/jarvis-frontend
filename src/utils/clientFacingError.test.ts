import { expect, it } from 'vitest'
import { clientFacingError } from './clientFacingError'

it.each(['Error de NextPyme', 'No hay token NEXTPYME_API_TOKEN', 'Error del proveedor', 'Falló el proveedor tecnológico'])('oculta referencias internas: %s', message => {
  expect(clientFacingError(message, 'No se pudo enviar el correo.')).toBe('No se pudo enviar el correo.')
})
it('conserva validaciones sobre el proveedor de una factura', () => {
  expect(clientFacingError('Selecciona el proveedor de la factura.')).toBe('Selecciona el proveedor de la factura.')
})
it.each(['Internal Server Error', 'Error interno del servidor', 'Request failed with status code 500', 'SQLSTATE[23505]', 'Cannot GET /private/path', 'ECONNREFUSED', 'TypeError: undefined'])('oculta mensajes técnicos: %s', message => {
  expect(clientFacingError(message)).toBe('Ha ocurrido un error. Inténtalo más tarde o comunícate con soporte.')
  expect(clientFacingError(message, 'No se pudo completar la operación.')).toBe('No se pudo completar la operación.')
})
it('no utiliza un mensaje técnico como alternativa', () => {
  expect(clientFacingError('Internal Server Error', 'Error interno del servidor')).toContain('comunícate con soporte')
})
