export const SIIGO_IMPORT_VALIDATION_STATUS = {
  THIRD_PARTY_REQUIRED: 'THIRD_PARTY_REQUIRED',
  ACCOUNT_REQUIRED: 'ACCOUNT_REQUIRED',
  READY: 'READY',
  NOT_FOUND: 'NOT_FOUND',
} as const

export type SiigoImportValidationStatus =
  (typeof SIIGO_IMPORT_VALIDATION_STATUS)[keyof typeof SIIGO_IMPORT_VALIDATION_STATUS]

export const ACCOUNT_MAPPING_STATUS = {
  ACCOUNT_MAPPED: 'ACCOUNT_MAPPED',
  ACCOUNT_MAPPING_REQUIRED: 'ACCOUNT_MAPPING_REQUIRED',
  ACCOUNT_MAPPING_FOUND: 'ACCOUNT_MAPPING_FOUND',
} as const

export type AccountMappingStatus =
  (typeof ACCOUNT_MAPPING_STATUS)[keyof typeof ACCOUNT_MAPPING_STATUS]

export interface DocumentIdRequest {
  documentId: string
}

export interface ValidateSiigoImportRequest extends DocumentIdRequest {}

export interface ValidateSiigoImportResponse {
  status: SiigoImportValidationStatus
  supplierConfigurationId: string | null
  supplierDocument: string
  supplierName: string | null
  accountCode: string | null
  message?: string
}

export type SiigoSupplierPersonType = 'person' | 'company'

export type SiigoSupplierIdType = '13' | '31'

export interface CreateSiigoSupplierRequest extends DocumentIdRequest {
  person_type: SiigoSupplierPersonType
  name?: string
  identification?: string
  id_type?: SiigoSupplierIdType
}

export interface SiigoCodeName {
  code: string
  name: string
}

export interface CreatedSiigoSupplier {
  id: string
  name: string
  documentType: string | SiigoCodeName
  documentNumber: string
  email: string
  phone: string
  address: string | Record<string, unknown>
}

export interface CreateSiigoSupplierResponse {
  success: boolean
  supplier: CreatedSiigoSupplier
}

export interface ValidateAccountMappingRequest extends DocumentIdRequest {}

export interface ValidateAccountMappingResponse {
  status: AccountMappingStatus
  accountCode?: string | null
  document?: Record<string, unknown>
}

export interface SaveAccountMappingRequest extends DocumentIdRequest {
  accountCode: string
  accountDescription: string
  paymentMethod?: {
    id: number
    name: string
    type: string
    dueDate?: boolean
  }
  retentions?: Array<{
    id: number
    name: string
    type: string
    percentage: number
  }>
  costCenter?: {
    id: number
    code: string
    name: string
  }
}

export interface SaveAccountMappingResponse {
  success: boolean
  document?: Record<string, unknown>
}

export interface CreateSiigoPurchaseRequest extends DocumentIdRequest {}

export interface CreateSiigoPurchaseSendProviderInvoice {
  prefix: string
  number: string
}

export interface CreateSiigoPurchaseSendRequest {
  documentId: string
  date: string
  supplier: CreateSiigoSupportDocumentSupplier
  provider_invoice: CreateSiigoPurchaseSendProviderInvoice
  observations?: string
  retentions?: CreateSiigoSupportDocumentRetention[]
  items: CreateSiigoSupportDocumentItem[]
  payments: CreateSiigoSupportDocumentPayment[]
  cost_center?: number
  savePreferences?: boolean
  supplierPreferences?: {
    accountCode?: string
    accountDescription?: string
    paymentMethod?: {
      id: number
      name: string
      type: string
      dueDate?: boolean
    }
    retentions?: Array<{
      id: number
      name: string
      type: string
      percentage: number
    }>
    costCenter?: {
      id: number
      code: string
      name: string
    }
  }
}

export interface CreateSiigoPurchaseSendResponse {
  success: boolean
  purchase: SiigoCreatedPurchase
  document?: Record<string, unknown>
}

export interface SiigoCreatedPurchase {
  id: string
  number: number
  name: string
  date: string
  total: number
  providerInvoicePrefix: string
  providerInvoiceNumber: string
}

export interface CreateSiigoPurchaseResponse {
  success: boolean
  purchase: SiigoCreatedPurchase
  document?: Record<string, unknown>
}

export interface CreateSiigoSupportDocumentSupplier {
  identification: string
  branch_office?: number
}

export interface CreateSiigoSupportDocumentReceiptNumber {
  prefix: string
  number: string
}

export interface CreateSiigoSupportDocumentItemTax {
  id: number
}

export interface CreateSiigoSupportDocumentRetention {
  id: number
  type?: string
}

export interface CreateSiigoSupportDocumentItem {
  type?: string
  code: string
  description?: string
  quantity: number
  price: number
  discount?: number
  taxes?: CreateSiigoSupportDocumentItemTax[]
}

export interface CreateSiigoSupportDocumentPayment {
  id: number
  value: number
  due_date?: string
}

export interface CreateSiigoSupportDocumentRequest {
  documentId: string
  date: string
  supplier: CreateSiigoSupportDocumentSupplier
  supplier_receipt_number: CreateSiigoSupportDocumentReceiptNumber
  observations?: string
  stamp?: {
    send: boolean
  }
  retentions?: CreateSiigoSupportDocumentRetention[]
  items: CreateSiigoSupportDocumentItem[]
  payments: CreateSiigoSupportDocumentPayment[]
  cost_center?: number
  savePreferences?: boolean
  supplierPreferences?: {
    accountCode?: string
    accountDescription?: string
    paymentMethod?: {
      id: number
      name: string
      type: string
      dueDate?: boolean
    }
    retentions?: Array<{
      id: number
      name: string
      type: string
      percentage: number
    }>
    costCenter?: {
      id: number
      code: string
      name: string
    }
  }
}

export interface SiigoCreatedSupportDocument {
  id: string
  number?: number
  name?: string
  date: string
  total?: number
  receiptPrefix?: string
  receiptNumber?: string
}

export interface CreateSiigoSupportDocumentResponse {
  success: boolean
  supportDocument: SiigoCreatedSupportDocument
  document?: Record<string, unknown>
}

export interface DeleteSiigoSupportDocumentResponse {
  success: boolean
  siigoSupportDocumentId: string
  document?: Record<string, unknown>
}

export function isSupplierNotFoundStatus(
  status: SiigoImportValidationStatus,
): boolean {
  return status === SIIGO_IMPORT_VALIDATION_STATUS.THIRD_PARTY_REQUIRED
}

export function isAccountMappingRequiredStatus(
  status: AccountMappingStatus,
): boolean {
  return status === ACCOUNT_MAPPING_STATUS.ACCOUNT_MAPPING_REQUIRED
}

export function isAccountMappingResolvedStatus(
  status: AccountMappingStatus,
): boolean {
  return (
    status === ACCOUNT_MAPPING_STATUS.ACCOUNT_MAPPED ||
    status === ACCOUNT_MAPPING_STATUS.ACCOUNT_MAPPING_FOUND
  )
}

export interface ImportBalanceTrialResponse {
  processedRows: number
  accountsCreated: number
  accountsUpdated: number
  skippedRows: number
  yearsProcessed: number
}

export interface SaveSiigoCredentialsRequest {
  username: string
  access_key: string
  partner_id: string
}

export interface SaveSiigoCredentialsResponse {
  success: boolean
  username: string
  partner_id: string
  expires_at: string
}

export interface SiigoSubscriptionPlan {
  id: string
  name: string
  code: string
  documentLimit: number | null
  includedDocumentTypes: string[]
}

export interface SiigoSubscriptionStatus {
  status: 'ACTIVE' | 'SUSPENDED' | 'CANCELLED' | null
  startedAt: string | null
  documentLimit: number | null
  documentsUsed: number
  includedDocumentTypes: string[]
  plan: SiigoSubscriptionPlan | null
}

export interface SiigoCredentialsStatusResponse {
  configured: boolean
  hasAccounts: boolean
  subscription: SiigoSubscriptionStatus
  username?: string
  partner_id?: string
}

export interface SiigoAccountCatalogItem {
  code: string
  name: string
}

export interface SiigoPaymentMethodCatalogItem {
  id: number
  name: string
  type: string
  dueDate: boolean
}

export interface SiigoCostCenterCatalogItem {
  id: number
  code: string
  name: string
}

export interface SiigoTaxCatalogItem {
  id: number
  name: string
  type: string
  percentage: number
  active: boolean
}
