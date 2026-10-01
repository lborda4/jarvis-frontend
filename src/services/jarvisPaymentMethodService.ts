import { apiClient } from './apiClient'
import { cachedQuery, companyQueryKey, invalidateQueryCache, QUERY_STALE_MS } from './queryCache'

export interface JarvisPaymentMethod {
  id: string
  name: string
  nextpymeMethodId: number
  nextpymeMethodName: string
}
export type SaveJarvisPaymentMethod = Pick<JarvisPaymentMethod, 'name' | 'nextpymeMethodId'>
export interface JarvisPaymentMethodsList { items: JarvisPaymentMethod[]; total: number }
const endpoint = '/integrations/jarvis/payment-methods'
export const paymentMethodsQueryKey = () => companyQueryKey(['jarvis', 'payment-methods'])

export function fetchJarvisPaymentMethods() {
  return cachedQuery(paymentMethodsQueryKey(), QUERY_STALE_MS.taxes,
    async () => (await apiClient.get<JarvisPaymentMethodsList>(endpoint)).data)
}

export async function saveJarvisPaymentMethod(request: SaveJarvisPaymentMethod, id?: string) {
  const key = paymentMethodsQueryKey()
  const response = id
    ? await apiClient.patch<{ paymentMethod: JarvisPaymentMethod }>(`${endpoint}/${encodeURIComponent(id)}`, request)
    : await apiClient.post<{ paymentMethod: JarvisPaymentMethod }>(endpoint, request)
  invalidateQueryCache(key)
  return response.data.paymentMethod
}

export async function deleteJarvisPaymentMethod(id: string) {
  const key = paymentMethodsQueryKey()
  await apiClient.delete(`${endpoint}/${encodeURIComponent(id)}`)
  invalidateQueryCache(key)
}

export function resolveJarvisPaymentMethodId(items: JarvisPaymentMethod[], selectedId: string): number {
  const method = items.find(item => item.id === selectedId)
  if (!method) throw new Error('Selecciona una forma de pago guardada en Categorías.')
  return method.nextpymeMethodId
}
