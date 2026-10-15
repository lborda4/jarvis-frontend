import { expect, it } from 'vitest'
import { clientFacingError } from './clientFacingError'

it.each(['Error de NextPyme', 'No hay token NEXTPYME_API_TOKEN', 'Error del proveedor', 'Falló el proveedor tecnológico'])('oculta referencias internas: %s', message => {
  expect(clientFacingError(message, 'No se pudo enviar el correo.')).toBe('No se pudo enviar el correo.')
})
it('conserva validaciones sobre el proveedor de una factura', () => {
  expect(clientFacingError('Selecciona el proveedor de la factura.')).toBe('Selecciona el proveedor de la factura.')
})
