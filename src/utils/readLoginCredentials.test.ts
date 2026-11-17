import { describe, expect, it } from 'vitest'
import { readLoginCredentials } from './readLoginCredentials'

describe('credenciales del formulario de ingreso', () => {
  it('lee los campos autocompletados sin depender del estado de React', () => {
    const form = new FormData()
    form.set('email', ' persona@example.com ')
    form.set('password', ' contraseña con espacios ')
    const credentials = readLoginCredentials(form)
    expect(credentials).toEqual({ email: 'persona@example.com', password: ' contraseña con espacios ' })
    // El reintento conserva la captura aunque el formulario se remonte o cambie.
    form.set('password', '')
    expect(credentials.password).toBe(' contraseña con espacios ')
    expect(readLoginCredentials(form).password).toBe('')
  })

  it('no recupera valores antiguos cuando el usuario vacía los campos', () => {
    const form = new FormData()
    form.set('email', '   ')
    form.set('password', '')
    expect(readLoginCredentials(form)).toEqual({ email: '', password: '' })
    expect(readLoginCredentials(new FormData())).toEqual({ email: '', password: '' })
  })
})
