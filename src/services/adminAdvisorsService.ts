import { apiClient } from './apiClient'
import type { AdminAdvisor, AdminAdvisorInput, AdvisorAccessDelivery } from '../types/admin'
const endpoint = '/admin/advisors'
export async function fetchAdminAdvisors(): Promise<{ items: AdminAdvisor[] }> { return (await apiClient.get(endpoint)).data }
export async function createAdminAdvisor(input: AdminAdvisorInput): Promise<{ advisor: AdminAdvisor; delivery: AdvisorAccessDelivery }> { return (await apiClient.post(endpoint, input)).data }
export async function updateAdminAdvisor(id: string, input: AdminAdvisorInput): Promise<{ advisor: AdminAdvisor }> { return (await apiClient.patch(`${endpoint}/${encodeURIComponent(id)}`, input)).data }
export async function sendAdvisorAccess(id: string): Promise<AdvisorAccessDelivery> { return (await apiClient.post(`${endpoint}/${encodeURIComponent(id)}/access`)).data }
export async function assignAdvisorClient(id: string, companyId: string, remove = false): Promise<{ advisor: AdminAdvisor }> {
  const path = `${endpoint}/${encodeURIComponent(id)}/clients/${encodeURIComponent(companyId)}`
  return (remove ? await apiClient.delete(path) : await apiClient.post(path)).data
}
