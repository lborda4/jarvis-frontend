import { apiClient } from './apiClient'
import type { AdvisorCatalog, AdvisorDashboard, CommissionReportData } from '../types/advisor'
import type { CreateAdminCompanyRequest, CreateAdminCompanyResponse } from '../types/admin'

export const fetchAdvisorCatalog = async (): Promise<AdvisorCatalog> => (await apiClient.get('/advisor/catalog')).data
export const fetchAdvisorDashboard = async (): Promise<AdvisorDashboard> => (await apiClient.get('/advisor/dashboard')).data
export const lookupAdvisorCompanyName = async (nit: string): Promise<{ name: string | null }> => (await apiClient.get('/advisor/companies/lookup-name', { params: { nit } })).data
export const createAdvisorCompany = async (input: CreateAdminCompanyRequest): Promise<CreateAdminCompanyResponse> => (await apiClient.post('/advisor/companies', input)).data
export const fetchCommissionReport = async (month: string, admin: boolean, filters?: { advisorId?: string; companyId?: string }): Promise<CommissionReportData> =>
  (await apiClient.get(admin ? '/admin/advisor-sales' : '/advisor/commissions', { params: { month, ...(admin ? filters : {}) } })).data
export const registerAdvisorSalePayment = async (id: string): Promise<{ message: string }> => (await apiClient.post(`/admin/advisor-sales/${encodeURIComponent(id)}/payment`)).data
