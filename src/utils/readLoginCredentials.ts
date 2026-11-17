import type { LoginRequest } from '../types/auth'

/** Lee también los valores autocompletados sin eventos de React. */
export function readLoginCredentials(formData: FormData): LoginRequest {
  const email = formData.get('email')
  const password = formData.get('password')
  return {
    email: typeof email === 'string' ? email.trim() : '',
    password: typeof password === 'string' ? password : '',
  }
}
