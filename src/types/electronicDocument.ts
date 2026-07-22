export const ELECTRONIC_DOCUMENT_TYPE = {
  PURCHASE_INVOICE: 'PURCHASE_INVOICE',
  SUPPORT_DOCUMENT: 'SUPPORT_DOCUMENT',
} as const

export type ElectronicDocumentType =
  (typeof ELECTRONIC_DOCUMENT_TYPE)[keyof typeof ELECTRONIC_DOCUMENT_TYPE]

export const ELECTRONIC_DOCUMENT_STATUS = {
  PENDING: 'PENDING',
  SUPPLIER_NOT_FOUND: 'SUPPLIER_NOT_FOUND',
  SUPPLIER_FOUND: 'SUPPLIER_FOUND',
  THIRD_PARTY_REQUIRED: 'THIRD_PARTY_REQUIRED',
  ACCOUNT_REQUIRED: 'ACCOUNT_REQUIRED',
  ACCOUNT_MAPPING_REQUIRED: 'ACCOUNT_MAPPING_REQUIRED',
  ACCOUNT_MAPPED: 'ACCOUNT_MAPPED',
  PURCHASE_CREATED: 'PURCHASE_CREATED',
  PURCHASE_FAILED: 'PURCHASE_FAILED',
  READY: 'READY',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
} as const

export type ElectronicDocumentStatus =
  (typeof ELECTRONIC_DOCUMENT_STATUS)[keyof typeof ELECTRONIC_DOCUMENT_STATUS]

export const ELECTRONIC_DOCUMENT_PROCESSING_STATUS = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  SUPPLIER_REQUIRED: 'SUPPLIER_REQUIRED',
  ACCOUNT_REQUIRED: 'ACCOUNT_REQUIRED',
  ACCOUNT_MAPPED: 'ACCOUNT_MAPPED',
  FAILED: 'FAILED',
} as const

export type ElectronicDocumentProcessingStatus =
  (typeof ELECTRONIC_DOCUMENT_PROCESSING_STATUS)[keyof typeof ELECTRONIC_DOCUMENT_PROCESSING_STATUS]

export interface SuggestedAccount {
  code: string
  name: string
  uses: number
}

export interface SuggestedPaymentMethod {
  id: number
  name: string
  type: string
  dueDate?: boolean
}

export interface SuggestedRetention {
  id: number
  name: string
  type: string
  percentage: number
}

export interface SuggestedCostCenter {
  id: number
  code: string
  name: string
}

export interface ElectronicDocumentListItemItem {
  description: string
  quantity: number
  unitValue: number
  total: number
}

export interface ElectronicDocumentListItem {
  id: string
  companyId: string
  companyName: string
  cufe: string | null
  invoiceNumber: string | null
  issueDate: string | null
  supplierName: string | null
  supplierNit: string | null
  total: number
  status: ElectronicDocumentStatus
  electronicDocumentType?: string | null
  siigoDocumentNumber?: number | null
  supplierExistsInSiigo?: boolean | null
  suggestedAccount?: SuggestedAccount | null
  suggestedPaymentMethod?: SuggestedPaymentMethod | null
  suggestedRetentions?: SuggestedRetention[]
  suggestedCostCenter?: SuggestedCostCenter | null
  processingStatus?: ElectronicDocumentProcessingStatus
  observations?: string | null
  items?: ElectronicDocumentListItemItem[]
  createdAt: string
  updatedAt: string
}

export interface ElectronicDocumentCompanyOption {
  id: string
  name: string
  nit: string
}

export interface ElectronicDocumentListResponse {
  items: ElectronicDocumentListItem[]
  total: number
  page: number
  limit: number
}

export interface ElectronicDocumentListFilters {
  status: string
  dateFrom: string
  dateTo: string
  search: string
  electronicDocumentType?: ElectronicDocumentType
  page?: number
  limit?: number
  supplierNits?: string[]
  issueDates?: string[]
  siigoDocumentNumbers?: string[]
  importStatuses?: string[]
}

export interface ElectronicDocumentSupplierFilterOption {
  nit: string
  name: string
}

export interface ElectronicDocumentFilterOptions {
  issueDates: string[]
  siigoDocumentNumbers: number[]
  importStatuses: string[]
  suppliers: ElectronicDocumentSupplierFilterOption[]
}

export type DocumentDashboardAction =
  | 'continue_supplier'
  | 'continue_account'
  | 'retry'
  | 'none'

export type ResumeNextStep =
  | 'SUPPLIER_REQUIRED'
  | 'ACCOUNT_REQUIRED'
  | 'COMPLETED'
  | 'FAILED'

export interface ResumeElectronicDocumentResponse {
  nextStep: ResumeNextStep
  message?: string
  document: ElectronicDocumentListItem
}
