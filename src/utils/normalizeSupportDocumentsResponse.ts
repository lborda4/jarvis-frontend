import type { ImportSupportDocumentsResponse } from '../types/supportDocument'
import type { ExtractInvoicesResponse } from '../types/invoice'
import { normalizeExtractInvoicesResponse } from './normalizeInvoicesResponse'

export function adaptSupportDocumentsImportResponse(
  data: Partial<ImportSupportDocumentsResponse> | null | undefined,
): ExtractInvoicesResponse | null {
  if (!data) return null

  return normalizeExtractInvoicesResponse({
    total: data.total ?? data.records?.length ?? data.documentsCreated ?? 0,
    filters: data.filters,
    records: data.records,
  })
}
