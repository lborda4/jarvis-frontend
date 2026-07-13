export interface InvoicePreview {
  cufe: string
  documentType: string
  folio: string
  prefix: string
  issueDate: string
  receptionDate: string
  issuerNit: string
  issuerName: string
  receiverNit: string
  receiverName: string
  currency: string
  paymentMethod: string
  total: number
  status: string
  group: string
}

export interface InvoiceFilters {
  documentTypes: string[]
  statuses: string[]
}

export interface ExtractInvoicesResponse {
  total: number
  filters: InvoiceFilters
  records: InvoicePreview[]
}

export interface InvoiceTableFilters {
  search: string
  documentType: string
  group: string
}

export const DEFAULT_INVOICE_TABLE_FILTERS: InvoiceTableFilters = {
  search: '',
  documentType: '',
  group: '',
}
