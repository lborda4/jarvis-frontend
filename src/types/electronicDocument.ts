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

export interface SuggestedAccount {
  code: string
  name: string
  uses: number
}

/** Sugerencia de producto (solo cuando la clasificación con IA determinó
 * itemType='Product') — a diferencia de `SuggestedAccount`, no trae `uses`
 * porque no hay un fallback de historial a nivel documento; el fallback por
 * proveedor se resuelve por ítem vía `SuggestedPurchaseItemConfig.productCode`. */
export interface SuggestedProduct {
  code: string
  name: string
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

export interface SuggestedItemTax {
  id: number
  name: string
  percentage: number
}

/** Config de ítem aprendida del historial de compras de este proveedor —
 * CADA campo se autocompleta de forma independiente según su propia
 * variabilidad (un proveedor puede tener cuenta contable fija y medio de
 * pago variable, o al revés): un campo en `null` significa que ESE campo
 * puntual no tiene un valor confiable, no que el proveedor entero sea
 * nuevo o desconocido — los demás campos pueden seguir viniendo
 * completos. El objeto entero es `null` solo si el proveedor nunca se
 * sincronizó. */
export interface SuggestedPurchaseItemConfig {
  itemType: 'Account' | 'Product' | null
  accountCode: string | null
  accountName: string | null
  /** Código de producto dominante del historial de este proveedor — solo
   * viene poblado cuando `itemType` es 'Product'. Se valida contra el
   * catálogo real de productos igual que `accountCode` se valida contra el
   * catálogo de cuentas (ver resolveValidatedProductCode). */
  productCode: string | null
  productName: string | null
  ivaTax: SuggestedItemTax | null
  retefuenteTax: SuggestedItemTax | null
  /** Medio de pago dominante del historial — si es de crédito (dueDate:
   * true), al autocompletarlo el editor muestra Plazo/Fecha de vencimiento
   * igual que si el usuario lo hubiera elegido a mano. */
  paymentMethod: SuggestedPaymentMethod | null
}

/** Cuenta PUC sugerida para ESTE ítem puntual, resuelta por proveedor +
 * descripción normalizada (ver SupplierItemAccountMapping en el backend).
 * `source: 'exact'` = regla confirmada para esta descripción — más
 * confiable que el tipo/cuenta dominante de todo el proveedor
 * (`suggestedItemConfig`), porque un proveedor puede facturar la mayoría de
 * sus conceptos como Producto pero tener UN concepto puntual que siempre va
 * a una cuenta de gasto específica. `source: 'fallback'` = el proveedor
 * tiene una única cuenta en su historial pero esta descripción es nueva —
 * sugerida, no confirmada. */
export interface SuggestedItemAccount {
  code: string
  name: string
  source: 'exact' | 'fallback'
}

export interface ElectronicDocumentListItemItem {
  description: string
  quantity: number
  unitValue: number
  total: number
  /** Código del producto/ítem tal como viene en la factura original (DIAN/NextPyme). */
  code?: string
  /** Descuento propio de la línea, si la factura original trae uno. */
  discount?: number
  suggestedTax?: SuggestedItemTax | null
  suggestedAccount?: SuggestedItemAccount | null
}

export interface ElectronicDocumentListItem {
  id: string
  companyId: string
  companyName: string
  cufe: string | null
  invoiceNumber: string | null
  issueDate: string | null
  dueDate: string | null
  /** Días de plazo explícitos del emisor (payment_form.duration_measure) — más confiable que dueDate - issueDate cuando está presente. */
  paymentDurationMeasure?: number | null
  documentDiscount?: number | null
  supplierName: string | null
  supplierNit: string | null
  supplierDocumentType?: string | null
  /** Subtotal certificado por la DIAN (tax_exclusive_amount) — no recalcular desde items. */
  documentSubtotal: number
  /** IVA certificado por la DIAN (suma de tax_totals de factura) — no recalcular desde items. */
  documentIva: number
  total: number
  status: ElectronicDocumentStatus
  electronicDocumentType?: string | null
  siigoDocumentNumber?: string | number | null
  supplierExistsInSiigo?: boolean | null
  /** true si quedó LISTA porque la factura ya existía en SIIGO al importar
   * el Excel (match por provider_invoice), no porque se envió desde acá —
   * ver mapDocumentToImportRowStatus, que lo muestra como "Existente en
   * SIIGO" en vez de "Lista". */
  alreadyInSiigo?: boolean
  suggestedAccount?: SuggestedAccount | null
  suggestedProduct?: SuggestedProduct | null
  suggestedPaymentMethod?: SuggestedPaymentMethod | null
  suggestedRetentions?: SuggestedRetention[]
  suggestedCostCenter?: SuggestedCostCenter | null
  suggestedItemConfig?: SuggestedPurchaseItemConfig | null
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
  issueDateFrom?: string
  issueDateTo?: string
  siigoDocumentNumbers?: string[]
  importStatuses?: string[]
}

export interface ElectronicDocumentSupplierFilterOption {
  nit: string
  name: string
}

export interface ElectronicDocumentFilterOptions {
  issueDates: string[]
  siigoDocumentNumbers: string[]
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
