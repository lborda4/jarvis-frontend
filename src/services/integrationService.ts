import type { IntegrationProvider } from '../types/integration'
import { apiClient } from './apiClient'

const INTEGRATIONS_PROVIDERS_ENDPOINT = '/integrations/providers'

export interface IntegrationProvidersResponse {
  providers: IntegrationProvider[]
}

export async function fetchIntegrationProviders(): Promise<IntegrationProvidersResponse> {
  const response = await apiClient.get<IntegrationProvidersResponse>(
    INTEGRATIONS_PROVIDERS_ENDPOINT,
  )

  return response.data
}
