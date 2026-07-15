import type { ImportRowStatus } from './import'

export type SupportDocumentSortColumn =
  | 'date'
  | 'supplier'
  | 'siigoNumber'
  | 'account'
  | 'paymentMethod'
  | 'retentions'
  | 'status'

export type SupportDocumentSortDirection = 'asc' | 'desc'

export interface SupportDocumentColumnFilters {
  date: string
  siigoNumber: string
  account: string
  paymentMethod: string
  retentions: string
  statuses: ImportRowStatus[]
}

export const EMPTY_SUPPORT_DOCUMENT_COLUMN_FILTERS: SupportDocumentColumnFilters =
  {
    date: '',
    siigoNumber: '',
    account: '',
    paymentMethod: '',
    retentions: '',
    statuses: [],
  }
