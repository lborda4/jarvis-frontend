import type {
  CreateAdminCompanyRequest,
  CreateAdminCompanyResponse,
  ListAdminCompaniesResponse,
  ListAdminPlansResponse,
} from '../types/admin'
import { apiClient } from './apiClient'

const ADMIN_COMPANIES_ENDPOINT = '/admin/companies'
const ADMIN_PLANS_ENDPOINT = '/admin/plans'

export async function fetchAdminPlans(): Promise<ListAdminPlansResponse> {
  const response = await apiClient.get<ListAdminPlansResponse>(
    ADMIN_PLANS_ENDPOINT,
  )

  return response.data
}

export async function fetchAdminCompanies(): Promise<ListAdminCompaniesResponse> {
  const response = await apiClient.get<ListAdminCompaniesResponse>(
    ADMIN_COMPANIES_ENDPOINT,
  )

  return response.data
}

export async function createAdminCompany(
  request: CreateAdminCompanyRequest,
): Promise<CreateAdminCompanyResponse> {
  const response = await apiClient.post<CreateAdminCompanyResponse>(
    ADMIN_COMPANIES_ENDPOINT,
    request,
  )

  return response.data
}
