export const JARVIS_ENTITY_TYPE = {
  NATURAL_PERSON: 'natural_person',
  LEGAL_ENTITY: 'legal_entity',
} as const

export type JarvisEntityType =
  (typeof JARVIS_ENTITY_TYPE)[keyof typeof JARVIS_ENTITY_TYPE]

export const JARVIS_TAX_REGIME = {
  SIMPLIFIED: 'simplified',
  COMMON: 'common',
  SPECIAL: 'special',
} as const

export type JarvisTaxRegime =
  (typeof JARVIS_TAX_REGIME)[keyof typeof JARVIS_TAX_REGIME]

export const JARVIS_VAT_REGIME = {
  RESPONSIBLE: 'vat_responsible',
  NON_RESPONSIBLE: 'non_vat_responsible',
} as const

export type JarvisVatRegime =
  (typeof JARVIS_VAT_REGIME)[keyof typeof JARVIS_VAT_REGIME]

export const JARVIS_TAX_RESPONSIBILITY = {
  LARGE_TAXPAYER: 'O-13',
  SELF_WITHHOLDER: 'O-15',
  VAT_WITHHOLDING_AGENT: 'O-23',
  SIMPLE_REGIME: 'O-47',
  NOT_APPLICABLE: 'R-99-PN',
} as const

export type JarvisTaxResponsibility =
  (typeof JARVIS_TAX_RESPONSIBILITY)[keyof typeof JARVIS_TAX_RESPONSIBILITY]

export const JARVIS_DOCUMENT_TYPE = {
  NIT: 'NIT',
  CC: 'CC',
  CE: 'CE',
  PA: 'PA',
} as const

export type JarvisDocumentType =
  (typeof JARVIS_DOCUMENT_TYPE)[keyof typeof JARVIS_DOCUMENT_TYPE]

export interface SaveJarvisCredentialsRequest {
  business_name: string
  trade_name?: string
  tax_regime: JarvisTaxRegime
  vat_regime: JarvisVatRegime
  tax_responsibility: JarvisTaxResponsibility
  economic_activity: string
  country: string
  department: string
  municipality: string
  city: string
  email: string
  address: string
  phone: string
}

export interface SaveJarvisCredentialsResponse {
  success: boolean
  business_name: string
  configured_at: string
}

export interface JarvisSubscriptionPlan {
  id: string
  name: string
  code: string
  documentLimit: number | null
  includedDocumentTypes: string[]
}

export interface JarvisSubscriptionStatus {
  status: 'ACTIVE' | 'SUSPENDED' | 'CANCELLED' | null
  startedAt: string | null
  documentLimit: number | null
  documentsUsed: number
  includedDocumentTypes: string[]
  plan: JarvisSubscriptionPlan | null
}

export interface JarvisDianResolution {
  kind: 'SUPPORT_DOCUMENT' | 'ELECTRONIC_INVOICE'
  formNumber?: string | null
  nit?: string | null
  checkDigit?: string | null
  businessName?: string | null
  documentTypeLabel: string
  modalityCode?: string | null
  prefix: string
  fromNumber: number
  toNumber: number
  nextConsecutive?: number | null
  requestType?: string | null
  year?: string | null
  authorizedAt?: string | null
  technicalKey?: string | null
  dateFrom?: string | null
  dateTo?: string | null
  configuredAt?: string | null
}

export interface JarvisCredentialsStatusResponse {
  configured: boolean
  subscription: JarvisSubscriptionStatus
  business_name?: string
  trade_name?: string
  economic_activity?: string
  tax_regime?: JarvisTaxRegime
  vat_regime?: JarvisVatRegime
  tax_responsibility?: JarvisTaxResponsibility
  country?: string
  department?: string
  municipality?: string
  city?: string
  email?: string
  address?: string
  phone?: string
  configured_at?: string
  supportDocumentResolution?: JarvisDianResolution | null
  electronicInvoiceResolution?: JarvisDianResolution | null
  supportDocumentResolutionConfigured?: boolean
  electronicInvoiceResolutionConfigured?: boolean
}

export interface JarvisTercero {
  id: string
  document_type: string
  document_number: string
  check_digit: string | null
  name: string
  entity_type: JarvisEntityType | null
  tax_regime: JarvisTaxRegime | null
  email: string | null
  phone: string | null
  address: string | null
  created_at: string
  updated_at: string
}

export interface JarvisTercerosListResponse {
  items: JarvisTercero[]
  total: number
}

export interface CreateJarvisTerceroRequest {
  document_type: JarvisDocumentType
  document_number: string
  name: string
  check_digit?: string
  entity_type?: JarvisEntityType
  tax_regime?: JarvisTaxRegime
  email?: string
  phone?: string
  address?: string
}

export interface CreateJarvisTerceroResponse {
  success: boolean
  tercero: JarvisTercero
}

export interface LookupJarvisTerceroNitResponse {
  found: boolean
  document_number: string
  check_digit: string | null
  name: string | null
  email: string | null
  phone: string | null
  address: string | null
}

export const JARVIS_ENTITY_TYPE_OPTIONS: Array<{
  value: JarvisEntityType
  label: string
}> = [
  { value: JARVIS_ENTITY_TYPE.NATURAL_PERSON, label: 'Persona natural' },
  { value: JARVIS_ENTITY_TYPE.LEGAL_ENTITY, label: 'Persona jurídica' },
]

export const JARVIS_TAX_REGIME_OPTIONS: Array<{
  value: JarvisTaxRegime
  label: string
}> = [
  { value: JARVIS_TAX_REGIME.COMMON, label: 'Régimen común' },
  { value: JARVIS_TAX_REGIME.SIMPLIFIED, label: 'Régimen simplificado' },
  { value: JARVIS_TAX_REGIME.SPECIAL, label: 'Régimen especial' },
]

export const JARVIS_VAT_REGIME_OPTIONS: Array<{
  value: JarvisVatRegime
  label: string
}> = [
  { value: JARVIS_VAT_REGIME.RESPONSIBLE, label: 'Responsable de IVA' },
  {
    value: JARVIS_VAT_REGIME.NON_RESPONSIBLE,
    label: 'No responsable de IVA',
  },
]

export const JARVIS_TAX_RESPONSIBILITY_OPTIONS: Array<{
  value: JarvisTaxResponsibility
  label: string
}> = [
  {
    value: JARVIS_TAX_RESPONSIBILITY.LARGE_TAXPAYER,
    label: 'Gran contribuyente',
  },
  {
    value: JARVIS_TAX_RESPONSIBILITY.SELF_WITHHOLDER,
    label: 'Autorretenedor',
  },
  {
    value: JARVIS_TAX_RESPONSIBILITY.VAT_WITHHOLDING_AGENT,
    label: 'Agente de retención en el impuesto sobre las ventas',
  },
  {
    value: JARVIS_TAX_RESPONSIBILITY.SIMPLE_REGIME,
    label: 'Régimen Simple de Tributación – SIMPLE',
  },
  {
    value: JARVIS_TAX_RESPONSIBILITY.NOT_APPLICABLE,
    label: 'No responsable R-99-PN',
  },
]

export const JARVIS_DOCUMENT_TYPE_OPTIONS: Array<{
  value: JarvisDocumentType
  label: string
}> = [
  { value: JARVIS_DOCUMENT_TYPE.NIT, label: 'NIT' },
  { value: JARVIS_DOCUMENT_TYPE.CC, label: 'Cédula de ciudadanía' },
  { value: JARVIS_DOCUMENT_TYPE.CE, label: 'Cédula de extranjería' },
  { value: JARVIS_DOCUMENT_TYPE.PA, label: 'Pasaporte' },
]
