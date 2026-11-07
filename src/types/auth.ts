export interface AuthCompany {
  jarvisModules?: import('./companyModules').JarvisModule[] | null
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
  registrationToken: string
  password: string
  acceptPrivacyPolicy: boolean
  acceptedIntegrationPolicyId?: string
}

export interface RegistrationLinkInfo {
  companyId: string
  companyName: string
  email: string
  existingAccount: boolean
  policyId: string
  version: string
}

export interface RefreshTokenRequest {
  refreshToken: string
}
