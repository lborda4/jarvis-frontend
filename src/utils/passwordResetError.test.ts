import { expect, it } from 'vitest'
import { publicAuthResetError } from './passwordResetError'

it('no muestra si el correo está registrado', () => {
  expect(publicAuthResetError('No existe una cuenta con ese correo.', 'Intenta nuevamente.')).toBe(
    'Intenta nuevamente.',
  )
  expect(publicAuthResetError('La contraseña debe tener al menos 6 caracteres.', 'Intenta nuevamente.')).toBe(
    'La contraseña debe tener al menos 6 caracteres.',
  )
})
