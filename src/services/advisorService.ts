import { cachedQuery } from './queryCache'
import { apiClient } from './apiClient'
import type { AdvisorCatalog, AdvisorDashboard, CommissionReportData } from '../types/advisor'
import type { CreateAdminCompanyRequest, CreateAdminCompanyResponse } from '../types/admin'

const advisorEndpoint = (advisorId?: string) => advisorId ? `/admin/advisors/${encodeURIComponent(advisorId)}` : '/advisor'

export const fetchAdvisorCatalog = async (advisorId?: string): Promise<AdvisorCatalog> => cachedQuery('advisor:catalog:' + (advisorId ? 'admin' : 'self'), 5 * 60_000, async () => (await apiClient.get(advisorId ? '/admin/advisors/portal/catalog' : '/advisor/catalog')).data)
export const fetchAdvisorDashboard = async (advisorId?: string): Promise<AdvisorDashboard> => cachedQuery('advisor:dashboard:' + (advisorId ?? 'self'), 60_000, async () => (await apiClient.get(`${advisorEndpoint(advisorId)}/dashboard`)).data)
export const lookupAdvisorCompanyName = async (nit: string, advisorId?: string): Promise<{ name: string | null }> => (await apiClient.get(advisorId ? '/admin/advisors/portal/lookup-name' : '/advisor/companies/lookup-name', { params: { nit } })).data
export const createAdvisorCompany = async (input: CreateAdminCompanyRequest, advisorId?: string): Promise<CreateAdminCompanyResponse> => (await apiClient.post(`${advisorEndpoint(advisorId)}/companies`, input)).data
export const fetchCommissionReport = async (month: string, admin: boolean, filters?: { advisorId?: string; companyId?: string }): Promise<CommissionReportData> =>
  (await apiClient.get(admin ? '/admin/advisor-sales' : '/advisor/commissions', { params: { month, ...(admin ? filters : {}) } })).data
export const registerAdvisorSalePayment = async (id: string): Promise<{ message: string }> => (await apiClient.post(`/admin/advisor-sales/${encodeURIComponent(id)}/payment`)).data
