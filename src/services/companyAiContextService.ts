import { apiClient } from './apiClient'
import type { CompanyAiContext } from '../types/companyAiContext'
const ENDPOINT = '/integrations/siigo/company-ai-context'
export async function fetchCompanyAiContext(): Promise<CompanyAiContext> {
  return (await apiClient.get<CompanyAiContext>(ENDPOINT)).data
}
export async function saveCompanyAiContext(
  context: CompanyAiContext,
): Promise<CompanyAiContext> {
  return (await apiClient.put<CompanyAiContext>(ENDPOINT, context)).data
}
