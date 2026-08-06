import type {
  AdminCompanyResponsible,
  CompanyPersonType,
  IntegrationProvider,
  JarvisCredentialsSeed,
} from './admin'

export interface AuthCompany {
  id: string
  name: string
  nit: string
}

export interface AuthUser {
  id: string
  name: string
  email: string
  role?: string
  company?: AuthCompany | null
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

export interface AuthSession {
  tokens: AuthTokens
  user: AuthUser | null
  companies: AuthCompany[]
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
    personType: CompanyPersonType
    provider: IntegrationProvider
    responsible: AdminCompanyResponsible
    jarvisCredentials?: JarvisCredentialsSeed
  }
}

export interface RefreshTokenRequest {
  refreshToken: string
}
