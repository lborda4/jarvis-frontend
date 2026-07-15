import type { SiigoAccountOption } from '../constants/siigoAccountCatalog'
import type { SiigoPaymentMethodOption } from '../constants/siigoPaymentMethodCatalog'
import type { SiigoTaxOption } from '../constants/siigoTaxCatalog'
import type {
  SupportDocumentColumnFilters,
  SupportDocumentSortColumn,
  SupportDocumentSortDirection,
} from '../types/supportDocumentTableFilters'
import type { SupportDocumentRow } from '../types/supportDocumentPage'
import {
  formatSupportDocumentTableAccount,
  formatSupportDocumentTableDate,
  formatSupportDocumentTablePaymentMethod,
  formatSupportDocumentTableRetentions,
  formatSupportDocumentTableSiigoNumber,
} from './formatSupportDocumentTableDisplay'

function normalizeQuery(value: string): string {
  return value.trim().toLowerCase()
}

function matchesQuery(haystack: string, query: string): boolean {
  const normalizedQuery = normalizeQuery(query)

  if (!normalizedQuery) {
    return true
  }

  return haystack.toLowerCase().includes(normalizedQuery)
}

export function rowMatchesColumnFilters(
  row: SupportDocumentRow,
  filters: SupportDocumentColumnFilters,
  rowDates: Record<string, string>,
  rowAccounts: Record<string, SiigoAccountOption | null>,
  rowPaymentMethods: Record<string, SiigoPaymentMethodOption | null>,
  rowRetentions: Record<string, SiigoTaxOption[]>,
): boolean {
  if (
    filters.statuses.length > 0 &&
    !filters.statuses.includes(row.importStatus)
  ) {
    return false
  }

  if (
    !matchesQuery(
      formatSupportDocumentTableDate(rowDates[row.id]),
      filters.date,
    )
  ) {
    return false
  }

  if (
    !matchesQuery(
      formatSupportDocumentTableSiigoNumber(row.siigoDocumentNumber),
      filters.siigoNumber,
    )
  ) {
    return false
  }

  if (
    !matchesQuery(
      formatSupportDocumentTableAccount(rowAccounts[row.id]),
      filters.account,
    )
  ) {
    return false
  }

  if (
    !matchesQuery(
      formatSupportDocumentTablePaymentMethod(rowPaymentMethods[row.id]),
      filters.paymentMethod,
    )
  ) {
    return false
  }

  if (
    !matchesQuery(
      formatSupportDocumentTableRetentions(rowRetentions[row.id]),
      filters.retentions,
    )
  ) {
    return false
  }

  return true
}

function compareStrings(left: string, right: string): number {
  return left.localeCompare(right, 'es', { sensitivity: 'base' })
}

export function sortSupportDocumentRows(
  rows: SupportDocumentRow[],
  sortColumn: SupportDocumentSortColumn | null,
  sortDirection: SupportDocumentSortDirection,
  rowDates: Record<string, string>,
  rowAccounts: Record<string, SiigoAccountOption | null>,
  rowPaymentMethods: Record<string, SiigoPaymentMethodOption | null>,
  rowRetentions: Record<string, SiigoTaxOption[]>,
): SupportDocumentRow[] {
  if (!sortColumn) {
    return rows
  }

  const direction = sortDirection === 'asc' ? 1 : -1

  return [...rows].sort((left, right) => {
    let comparison = 0

    switch (sortColumn) {
      case 'date':
        comparison = compareStrings(
          formatSupportDocumentTableDate(rowDates[left.id]),
          formatSupportDocumentTableDate(rowDates[right.id]),
        )
        break
      case 'supplier':
        comparison = compareStrings(left.supplierName, right.supplierName)
        break
      case 'siigoNumber':
        comparison = compareStrings(
          formatSupportDocumentTableSiigoNumber(left.siigoDocumentNumber),
          formatSupportDocumentTableSiigoNumber(right.siigoDocumentNumber),
        )
        break
      case 'account':
        comparison = compareStrings(
          formatSupportDocumentTableAccount(rowAccounts[left.id]),
          formatSupportDocumentTableAccount(rowAccounts[right.id]),
        )
        break
      case 'paymentMethod':
        comparison = compareStrings(
          formatSupportDocumentTablePaymentMethod(rowPaymentMethods[left.id]),
          formatSupportDocumentTablePaymentMethod(rowPaymentMethods[right.id]),
        )
        break
      case 'retentions':
        comparison = compareStrings(
          formatSupportDocumentTableRetentions(rowRetentions[left.id]),
          formatSupportDocumentTableRetentions(rowRetentions[right.id]),
        )
        break
      case 'status':
        comparison = compareStrings(left.importStatus, right.importStatus)
        break
      default:
        comparison = 0
    }

    return comparison * direction
  })
}

export function columnFilterIsActive(
  filters: SupportDocumentColumnFilters,
  key: keyof SupportDocumentColumnFilters,
): boolean {
  const value = filters[key]

  if (Array.isArray(value)) {
    return value.length > 0
  }

  return value.trim().length > 0
}
