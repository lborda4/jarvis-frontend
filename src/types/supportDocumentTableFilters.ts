import type { ImportRowStatus } from './import'

export type SupportDocumentSortColumn =
  | 'createdAt'
  | 'date'
  | 'supplier'
  | 'siigoNumber'
  | 'account'
  | 'paymentMethod'
  | 'retentions'
  | 'iva'
  | 'status'

export type SupportDocumentSortDirection = 'asc' | 'desc'

export interface SupportDocumentColumnFilters {
  /** Documento soporte: multi-selección de fechas exactas. */
  dates: string[]
  /** Factura de compra: rango de fechas (calendario "desde"/"hasta") — ver
   * documentWorkspaceConfig.ts (dateFilterMode). */
  dateFrom: string | null
  dateTo: string | null
  siigoNumbers: string[]
  statuses: ImportRowStatus[]
}

export const EMPTY_SUPPORT_DOCUMENT_COLUMN_FILTERS: SupportDocumentColumnFilters =
  {
    dates: [],
    dateFrom: null,
    dateTo: null,
    siigoNumbers: [],
    statuses: [],
  }
