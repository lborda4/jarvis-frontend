import type { AiPurchaseSuggestion } from '../types/aiSuggestion'
import { apiClient } from './apiClient'

export async function requestAiPurchaseSuggestion(
  documentId: string,
): Promise<AiPurchaseSuggestion> {
  const response = await apiClient.post<AiPurchaseSuggestion>(
    `/integrations/siigo/documents/${documentId}/ai-suggestion`,
  )

  return response.data
}
