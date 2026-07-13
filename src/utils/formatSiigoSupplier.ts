import type { SiigoCodeName } from '../types/siigo'

export type SiigoDocumentTypeValue = string | SiigoCodeName

export function isSiigoCodeName(value: unknown): value is SiigoCodeName {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'name' in value
  )
}

export function formatSiigoDocumentType(
  documentType: SiigoDocumentTypeValue | null | undefined,
): string {
  if (!documentType) return ''

  if (typeof documentType === 'string') {
    return documentType.trim()
  }

  const code = documentType.code?.trim() ?? ''
  const name = documentType.name?.trim() ?? ''

  if (code && name) {
    return `${code} - ${name}`
  }

  return name || code
}

export function formatSiigoDisplayValue(value: unknown): string {
  if (value == null) return ''

  if (typeof value === 'string') {
    return value.trim()
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  if (isSiigoCodeName(value)) {
    return formatSiigoDocumentType(value)
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>

    if ('address' in record && typeof record.address === 'string') {
      const address = record.address.trim()
      const city = formatSiigoDisplayValue(record.city)
      return [address, city].filter(Boolean).join(', ')
    }

    if (typeof record.name === 'string') {
      const name = record.name.trim()
      const code =
        typeof record.code === 'string' || typeof record.code === 'number'
          ? String(record.code).trim()
          : ''

      if (code && name) {
        return `${code} - ${name}`
      }

      return name || code
    }

    if (typeof record.code === 'string') {
      return record.code.trim()
    }
  }

  return ''
}
