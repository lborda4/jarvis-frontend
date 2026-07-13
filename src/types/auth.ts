export interface AuthCompany {
  id: string
  name: string
  nit: string
}

export interface AuthUser {
  id: string
  name: string
  email: string
  company?: AuthCompany | null
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

export interface AuthSession {
  tokens: AuthTokens
  user: AuthUser | null
}

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  name: string
  email: string
  password: string
  company: {
    name: string
    nit: string
  }
}

export interface RefreshTokenRequest {
  refreshToken: string
}
