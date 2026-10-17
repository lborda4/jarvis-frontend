import { apiClient } from './apiClient'
export interface JarvisSeller { id: string; name: string }
const endpoint = '/integrations/jarvis/sellers'
export async function fetchJarvisSellers(): Promise<JarvisSeller[]> {
  return (await apiClient.get<{ items: JarvisSeller[] }>(endpoint)).data.items
}
export async function createJarvisSeller(name: string): Promise<JarvisSeller> {
  return (await apiClient.post<{ seller: JarvisSeller }>(endpoint, { name })).data.seller
}
