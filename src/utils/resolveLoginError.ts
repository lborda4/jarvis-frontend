import axios from 'axios'
import { getApiErrorMessage } from '../services/apiClient'

export const LOGIN_ERROR_CODE = {
  ACCOUNT_NOT_FOUND: 'ACCOUNT_NOT_FOUND',
  INVALID_PASSWORD: 'INVALID_PASSWORD',
  ACCOUNT_INACTIVE: 'ACCOUNT_INACTIVE',
  NO_ACTIVE_COMPANY: 'NO_ACTIVE_COMPANY',
} as const

export type LoginErrorKind =
  | 'account_not_found'
  | 'invalid_password'
  | 'inactive'
  | 'other'

export interface ResolvedLoginError {
  message: string
  kind: LoginErrorKind
}

function mapCodeToKind(code: string | undefined): LoginErrorKind {
  switch (code) {
    case LOGIN_ERROR_CODE.ACCOUNT_NOT_FOUND:
      return 'account_not_found'
    case LOGIN_ERROR_CODE.INVALID_PASSWORD:
      return 'invalid_password'
    case LOGIN_ERROR_CODE.ACCOUNT_INACTIVE:
    case LOGIN_ERROR_CODE.NO_ACTIVE_COMPANY:
      return 'inactive'
    default:
      return 'other'
  }
}

function mapMessageToKind(message: string): LoginErrorKind {
  const normalized = message.toLowerCase()

  if (normalized.includes('no existe una cuenta')) {
    return 'account_not_found'
  }

  if (
    normalized.includes('contraseña es incorrecta') ||
    normalized.includes('credenciales inválidas')
  ) {
    return 'invalid_password'
  }

  return 'other'
}

export function resolveLoginError(
  error: unknown,
  fallbackMessage = 'No se pudo iniciar sesión. Intenta nuevamente.',
): ResolvedLoginError {
  const message = getApiErrorMessage(error, fallbackMessage)

  if (axios.isAxiosError(error)) {
    const data = error.response?.data

    if (typeof data === 'object' && data !== null && 'code' in data) {
      const code = data.code

      if (typeof code === 'string') {
        return {
          message,
          kind: mapCodeToKind(code),
        }
      }
    }
  }

  return {
    message,
    kind: mapMessageToKind(message),
  }
}
