export const INTEGRATION_PROVIDER = {
  SIIGO: 'SIIGO',
  JARVIS: 'JARVIS',
} as const

export type IntegrationProvider =
  (typeof INTEGRATION_PROVIDER)[keyof typeof INTEGRATION_PROVIDER]

export const COMPANY_PERSON_TYPE = {
  NATURAL_PERSON: 'NATURAL_PERSON',
  LEGAL_ENTITY: 'LEGAL_ENTITY',
} as const

export type CompanyPersonType =
  (typeof COMPANY_PERSON_TYPE)[keyof typeof COMPANY_PERSON_TYPE]

export const SUBSCRIPTION_STATUS = {
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  CANCELLED: 'CANCELLED',
} as const

export type SubscriptionStatus =
  (typeof SUBSCRIPTION_STATUS)[keyof typeof SUBSCRIPTION_STATUS]

export const ELECTRONIC_DOCUMENT_TYPE = {
  PURCHASE_INVOICE: 'PURCHASE_INVOICE',
  SUPPORT_DOCUMENT: 'SUPPORT_DOCUMENT',
} as const

export type ElectronicDocumentType =
  (typeof ELECTRONIC_DOCUMENT_TYPE)[keyof typeof ELECTRONIC_DOCUMENT_TYPE]

export interface AdminCompanyResponsible {
  name: string
  phone: string
  email: string
}

export interface AdminPlan {
  id: string
  name: string
  code: string
  provider: IntegrationProvider
  documentLimit: number | null
  includedDocumentTypes: ElectronicDocumentType[]
}

export interface AdminIntegrationItem {
  id: string
  provider: IntegrationProvider
  active: boolean
  subscriptionStatus: SubscriptionStatus | null
  subscriptionStartedAt: string | null
  includedDocumentTypes: ElectronicDocumentType[]
  plan: AdminPlan | null
}

export interface AdminCompanyListItem {
  id: string
  nit: string
  name: string
  personType: CompanyPersonType | null
  responsible: AdminCompanyResponsible | null
  createdAt: string
  integrations: AdminIntegrationItem[]
}

export interface ListAdminCompaniesResponse {
  items: AdminCompanyListItem[]
}

export interface ListAdminPlansResponse {
  items: AdminPlan[]
}

export interface CreateAdminCompanyRequest {
  nit: string
  name: string
  personType: CompanyPersonType
  responsible: AdminCompanyResponsible
  integrations: IntegrationProvider[]
  siigoPlanId?: string
  jarvisPlanId?: string
  includedDocumentTypes?: ElectronicDocumentType[]
  jarvisCredentials?: JarvisCredentialsSeed
}

export interface JarvisCredentialsSeed {
  business_name?: string
  trade_name?: string
  tax_regime?: string
  vat_regime?: string
  tax_responsibility?: string
  economic_activity?: string
  country?: string
  department?: string
  municipality?: string
  city?: string
  email?: string
  address?: string
  phone?: string
  idSoftware?: string
  tokenNextPyme?: string
}

export interface CreateAdminCompanyResponse {
  company: AdminCompanyListItem
}

export interface UpdateIntegrationSubscriptionRequest {
  planId?: string
  subscriptionStatus?: SubscriptionStatus
  includedDocumentTypes?: ElectronicDocumentType[]
  restartSubscription?: boolean
}

export interface UpdateIntegrationSubscriptionResponse {
  integration: AdminIntegrationItem
}

export interface ParsedRutJarvisCredentials {
  business_name: string | null
  trade_name: string | null
  tax_regime: string | null
  vat_regime: string | null
  tax_responsibility: string | null
  economic_activity: string | null
  country: string | null
  department: string | null
  municipality: string | null
  city: string | null
  email: string | null
  address: string | null
  phone: string | null
}

export interface ParsedRutData {
  nit: string
  verificationDigit: string | null
  name: string
  personType: CompanyPersonType
  address: string | null
  email: string | null
  phone: string | null
  responsibleName: string | null
  jarvisCredentials: ParsedRutJarvisCredentials
  warnings: string[]
}

export interface ParseRutResponse {
  data: ParsedRutData
}
