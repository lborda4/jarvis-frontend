import type {
  AuthSession,
  AuthTokens,
  AuthUser,
  LoginRequest,
  RefreshTokenRequest,
  RegisterRequest,
} from '../types/auth'
import {
  AUTH_LOGIN_ENDPOINT,
  AUTH_ME_ENDPOINT,
  AUTH_REFRESH_ENDPOINT,
  AUTH_REGISTER_ENDPOINT,
  AUTH_RUT_PARSE_ENDPOINT,
  AUTH_SWITCH_COMPANY_ENDPOINT,
} from '../constants/authEndpoints'
import type { ParseRutResponse } from '../types/admin'
import {
  extractAuthSession,
  extractAuthTokens,
  extractAuthUser,
  extractAuthCompanies,
} from '../utils/authTokens'
import { apiClient } from './apiClient'
import { clearTokens, getRefreshToken, setTokens } from './authStorage'

function toAuthSession(data: unknown): AuthSession {
  const session = extractAuthSession(data)

  if (!session) {
    throw new Error('La respuesta de autenticación no incluyó tokens válidos.')
  }

  return session
}

export async function login(request: LoginRequest): Promise<AuthSession> {
  const response = await apiClient.post(AUTH_LOGIN_ENDPOINT, request)
  const session = toAuthSession(response.data)

  setTokens(session.tokens)

  return session
}

export async function register(request: RegisterRequest): Promise<AuthSession> {
  const response = await apiClient.post(AUTH_REGISTER_ENDPOINT, request)
  const session = toAuthSession(response.data)

  setTokens(session.tokens)

  return session
}

export async function parseRegistrationRut(
  file: File,
): Promise<ParseRutResponse> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await apiClient.post<ParseRutResponse>(
    AUTH_RUT_PARSE_ENDPOINT,
    formData,
  )

  return response.data
}

export async function switchCompany(companyId: string): Promise<AuthSession> {
  const response = await apiClient.post(AUTH_SWITCH_COMPANY_ENDPOINT, {
    companyId,
  })
  const session = toAuthSession(response.data)

  setTokens(session.tokens)

  return session
}

export async function refreshSession(
  refreshTokenOverride?: string,
): Promise<AuthTokens> {
  const refreshToken = refreshTokenOverride ?? getRefreshToken()

  if (!refreshToken) {
    throw new Error('No hay refresh token disponible.')
  }

  const payload: RefreshTokenRequest = { refreshToken }
  const response = await apiClient.post(AUTH_REFRESH_ENDPOINT, payload)
  const tokens = extractAuthTokens(response.data)

  if (!tokens) {
    clearTokens()
    throw new Error('No se pudo renovar la sesión.')
  }

  setTokens(tokens)
  return tokens
}

export async function fetchCurrentUser(): Promise<{
  user: AuthUser
  companies: AuthSession['companies']
}> {
  const response = await apiClient.get(AUTH_ME_ENDPOINT)

  const user = extractAuthUser(response.data)

  if (!user) {
    throw new Error('No se pudo obtener la información del usuario.')
  }

  return {
    user,
    companies: extractAuthCompanies(response.data),
  }
}

export function logout(): void {
  clearTokens()
}
