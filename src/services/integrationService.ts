import type { IntegrationProvider } from '../types/integration'
import { apiClient } from './apiClient'
import {
  cachedQuery,
  companyQueryKey,
  QUERY_STALE_MS,
} from './queryCache'

const INTEGRATIONS_PROVIDERS_ENDPOINT = '/integrations/providers'

export interface IntegrationProvidersResponse {
  providers: IntegrationProvider[]
}

export async function fetchIntegrationProviders(): Promise<IntegrationProvidersResponse> {
  return cachedQuery(
    companyQueryKey(['integrations', 'providers']),
    QUERY_STALE_MS.providers,
    async () => {
      const response = await apiClient.get<IntegrationProvidersResponse>(
        INTEGRATIONS_PROVIDERS_ENDPOINT,
      )
      return response.data
    },
  )
}
