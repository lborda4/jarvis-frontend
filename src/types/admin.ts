export const INTEGRATION_PROVIDER = {
  SIIGO: 'SIIGO',
  JARVIS: 'JARVIS',
} as const

export type IntegrationProvider =
  (typeof INTEGRATION_PROVIDER)[keyof typeof INTEGRATION_PROVIDER]

export interface AdminCompanyResponsible {
  name: string
  phone: string
  email: string
}

export interface AdminPlan {
  id: string
  name: string
  code: string
  documentLimit: number | null
}

export interface AdminIntegrationItem {
  provider: IntegrationProvider
  active: boolean
}

export interface AdminCompanyListItem {
  id: string
  nit: string
  name: string
  responsible: AdminCompanyResponsible | null
  createdAt: string
  companyPlan: AdminPlan | null
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
  responsible: AdminCompanyResponsible
  integrations: IntegrationProvider[]
  companyPlanId: string
}

export interface CreateAdminCompanyResponse {
  company: AdminCompanyListItem
}
