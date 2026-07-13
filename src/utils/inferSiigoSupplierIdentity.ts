export type SiigoPersonType = 'person' | 'company'

export type SiigoIdType = '13' | '31'

export interface SiigoSupplierIdentity {
  personType: SiigoPersonType
  idType: SiigoIdType
}

function normalizeDocumentNumber(documentNumber: string): string {
  return documentNumber.trim()
}

function digitsOnly(documentNumber: string): string {
  return documentNumber.replace(/\D/g, '')
}

export function getSupplierIdTypeLabel(idType: SiigoIdType): 'CC' | 'NIT' {
  return idType === '31' ? 'NIT' : 'CC'
}

export function formatSupplierDocumentDisplay(documentNumber: string): string {
  const trimmed = documentNumber.trim()

  if (!trimmed || trimmed === '—') {
    return trimmed || '—'
  }

  const { idType } = inferSiigoSupplierIdentity(trimmed)
  return `${getSupplierIdTypeLabel(idType)} ${trimmed}`
}

export function inferSiigoSupplierIdentity(
  documentNumber: string,
): SiigoSupplierIdentity {
  const normalized = normalizeDocumentNumber(documentNumber)
  const digits = digitsOnly(normalized)

  const hasVerificationDigit = normalized.includes('-')
  const looksLikeNit = hasVerificationDigit || digits.length >= 9

  if (looksLikeNit) {
    return {
      personType: 'company',
      idType: '31',
    }
  }

  return {
    personType: 'person',
    idType: '13',
  }
}
