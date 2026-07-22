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
  NON_VAT: 'non_vat',
  LARGE_TAXPAYER: 'large_taxpayer',
} as const

export type JarvisTaxRegime =
  (typeof JARVIS_TAX_REGIME)[keyof typeof JARVIS_TAX_REGIME]

export interface SaveJarvisCredentialsRequest {
  business_name: string
  economic_activity: string
  entity_type: JarvisEntityType
  tax_regime: JarvisTaxRegime
}

export interface SaveJarvisCredentialsResponse {
  success: boolean
  business_name: string
  configured_at: string
}

export interface JarvisCredentialsStatusResponse {
  configured: boolean
  business_name?: string
  economic_activity?: string
  entity_type?: JarvisEntityType
  tax_regime?: JarvisTaxRegime
  configured_at?: string
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
  { value: JARVIS_TAX_REGIME.SIMPLIFIED, label: 'Régimen simplificado' },
  { value: JARVIS_TAX_REGIME.COMMON, label: 'Régimen común' },
  { value: JARVIS_TAX_REGIME.SPECIAL, label: 'Régimen especial' },
  { value: JARVIS_TAX_REGIME.NON_VAT, label: 'No responsable de IVA' },
  {
    value: JARVIS_TAX_REGIME.LARGE_TAXPAYER,
    label: 'Gran contribuyente',
  },
]
