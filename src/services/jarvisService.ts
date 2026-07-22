import type {
  JarvisCredentialsStatusResponse,
  SaveJarvisCredentialsRequest,
  SaveJarvisCredentialsResponse,
} from '../types/jarvis'
import { apiClient } from './apiClient'

const JARVIS_CREDENTIALS_STATUS_ENDPOINT =
  '/integrations/jarvis/credentials/status'
const JARVIS_CREDENTIALS_ENDPOINT = '/integrations/jarvis/credentials'

export async function fetchJarvisCredentialsStatus(): Promise<JarvisCredentialsStatusResponse> {
  const response = await apiClient.get<JarvisCredentialsStatusResponse>(
    JARVIS_CREDENTIALS_STATUS_ENDPOINT,
  )

  return response.data
}

export async function fetchJarvisCredentialsConfigured(): Promise<boolean> {
  const status = await fetchJarvisCredentialsStatus()
  return status.configured
}

export async function saveJarvisCredentials(
  request: SaveJarvisCredentialsRequest,
): Promise<SaveJarvisCredentialsResponse> {
  const response = await apiClient.post<SaveJarvisCredentialsResponse>(
    JARVIS_CREDENTIALS_ENDPOINT,
    request,
  )

  return response.data
}
