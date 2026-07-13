import { formatAccountOptionLabel } from '../constants/siigoAccountCatalog'
import type { SiigoAccountOption } from '../constants/siigoAccountCatalog'
import { formatPaymentMethodOptionLabel } from '../constants/siigoPaymentMethodCatalog'
import type { SiigoPaymentMethodOption } from '../constants/siigoPaymentMethodCatalog'
import { formatTaxOptionLabel } from '../constants/siigoTaxCatalog'
import type { SiigoTaxOption } from '../constants/siigoTaxCatalog'
import { formatSupplierDocumentDisplay } from './inferSiigoSupplierIdentity'

export function formatSupportDocumentTableDate(value: string | undefined): string {
  const trimmed = value?.trim()

  if (!trimmed) {
    return '—'
  }

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/)

  if (isoMatch) {
    const [, year, month, day] = isoMatch
    return `${day}/${month}/${year}`
  }

  return trimmed
}

export function formatSupportDocumentTableAccount(
  account: SiigoAccountOption | null | undefined,
): string {
  if (!account) {
    return '—'
  }

  return formatAccountOptionLabel(account)
}

export function formatSupportDocumentTablePaymentMethod(
  paymentMethod: SiigoPaymentMethodOption | null | undefined,
): string {
  if (!paymentMethod) {
    return '—'
  }

  return formatPaymentMethodOptionLabel(paymentMethod)
}

export function formatSupportDocumentTableRetentions(
  retentions: SiigoTaxOption[] | undefined,
): string {
  if (!retentions || retentions.length === 0) {
    return '—'
  }

  return retentions.map((tax) => formatTaxOptionLabel(tax)).join(', ')
}

export function formatSupportDocumentTableSupplierDocument(
  documentNumber: string | undefined,
): string {
  return formatSupplierDocumentDisplay(documentNumber?.trim() || '—')
}
