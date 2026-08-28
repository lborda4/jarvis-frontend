export interface AiSuggestedRetention {
  id: number
  name: string
  type: string
  percentage: number
}

export interface AiPurchaseSuggestion {
  accountCode: string | null
  accountName: string | null
  taxId: number | null
  taxName: string | null
  taxPercentage: number | null
  retentionSuggestions: AiSuggestedRetention[]
}
