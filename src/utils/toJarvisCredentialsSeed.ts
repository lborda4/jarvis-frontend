import type {
  JarvisCredentialsSeed,
  ParsedRutJarvisCredentials,
} from '../types/admin'

export function toJarvisCredentialsSeed(
  credentials?: ParsedRutJarvisCredentials | null,
): JarvisCredentialsSeed | undefined {
  if (!credentials) {
    return undefined
  }

  const seed: JarvisCredentialsSeed = {}

  const assign = (key: keyof JarvisCredentialsSeed, value: string | null) => {
    const trimmed = value?.trim()
    if (trimmed) {
      seed[key] = trimmed
    }
  }

  assign('business_name', credentials.business_name)
  assign('trade_name', credentials.trade_name)
  assign('tax_regime', credentials.tax_regime)
  assign('vat_regime', credentials.vat_regime)
  assign('tax_responsibility', credentials.tax_responsibility)
  assign('economic_activity', credentials.economic_activity)
  assign('country', credentials.country)
  assign('department', credentials.department)
  assign('municipality', credentials.municipality)
  assign('city', credentials.city)
  assign('email', credentials.email)
  assign('address', credentials.address)
  assign('phone', credentials.phone)

  return Object.keys(seed).length > 0 ? seed : undefined
}
