import { expect, it } from 'vitest'
import { getApiErrorMessage } from './apiClient'

it.each([500, 502, 503])('muestra ayuda sin detalles técnicos para HTTP %s', status => {
  const error = { isAxiosError: true, response: { status, data: { message: 'Internal Server Error', error: 'SQLSTATE[23505]' } } }
  expect(getApiErrorMessage(error, 'No se pudo completar.')).toBe('Ha ocurrido un error. Inténtalo más tarde o comunícate con soporte.')
})
it('conserva las validaciones que el usuario sí puede corregir', () => {
  expect(getApiErrorMessage({ isAxiosError: true, response: { status: 400, data: { message: 'Ingresa el correo del empleado.' } } }, 'Intenta nuevamente.')).toBe('Ingresa el correo del empleado.')
})
it('no muestra códigos HTTP ni páginas de error cuando no hay mensaje JSON', () => {
  expect(getApiErrorMessage({ isAxiosError: true, response: { status: 404, data: 'Cannot GET /private' } }, 'No se pudo cargar la información.')).toBe('No se pudo cargar la información.')
})
