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
} from '../constants/authEndpoints'
import { extractAuthTokens, extractAuthUser } from '../utils/authTokens'
import { apiClient } from './apiClient'
import { clearTokens, getRefreshToken, setTokens } from './authStorage'

export async function login(request: LoginRequest): Promise<AuthSession> {
  const response = await apiClient.post(AUTH_LOGIN_ENDPOINT, request)
  const tokens = extractAuthTokens(response.data)

  if (!tokens) {
    throw new Error('La respuesta de inicio de sesión no incluyó tokens válidos.')
  }

  setTokens(tokens)

  return {
    tokens,
    user: extractAuthUser(response.data),
  }
}

export async function register(request: RegisterRequest): Promise<AuthSession> {
  const response = await apiClient.post(AUTH_REGISTER_ENDPOINT, request)
  const tokens = extractAuthTokens(response.data)

  if (!tokens) {
    throw new Error('La respuesta de registro no incluyó tokens válidos.')
  }

  setTokens(tokens)

  return {
    tokens,
    user: extractAuthUser(response.data),
  }
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

export async function fetchCurrentUser(): Promise<AuthUser> {
  const response = await apiClient.get(AUTH_ME_ENDPOINT)

  console.log('[Auth] Respuesta GET /auth/me:', response.data)

  const user = extractAuthUser(response.data)

  if (!user) {
    throw new Error('No se pudo obtener la información del usuario.')
  }

  return user
}

export function logout(): void {
  clearTokens()
}
