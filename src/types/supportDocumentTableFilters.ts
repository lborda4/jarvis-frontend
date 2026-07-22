import type { ImportRowStatus } from './import'

export type SupportDocumentSortColumn =
  | 'createdAt'
  | 'date'
  | 'supplier'
  | 'siigoNumber'
  | 'account'
  | 'paymentMethod'
  | 'retentions'
  | 'status'

export type SupportDocumentSortDirection = 'asc' | 'desc'

export interface SupportDocumentColumnFilters {
  dates: string[]
  siigoNumbers: string[]
  statuses: ImportRowStatus[]
}

export const EMPTY_SUPPORT_DOCUMENT_COLUMN_FILTERS: SupportDocumentColumnFilters =
  {
    dates: [],
    siigoNumbers: [],
    statuses: [],
  }
