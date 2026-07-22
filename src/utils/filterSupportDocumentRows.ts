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

function compareStrings(left: string, right: string): number {
  return left.localeCompare(right, 'es', { sensitivity: 'base' })
}

function compareCreatedAt(left: string, right: string): number {
  return left.localeCompare(right)
}

export function rowMatchesColumnFilters(
  row: SupportDocumentRow,
  filters: SupportDocumentColumnFilters,
  rowDates: Record<string, string>,
): boolean {
  if (
    filters.statuses.length > 0 &&
    !filters.statuses.includes(row.importStatus)
  ) {
    return false
  }

  if (filters.dates.length > 0) {
    const dateLabel = formatSupportDocumentTableDate(rowDates[row.id])

    if (!filters.dates.includes(dateLabel)) {
      return false
    }
  }

  if (filters.siigoNumbers.length > 0) {
    const siigoLabel = formatSupportDocumentTableSiigoNumber(
      row.siigoDocumentNumber,
    )

    if (!filters.siigoNumbers.includes(siigoLabel)) {
      return false
    }
  }

  return true
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
  const effectiveSortColumn = sortColumn ?? 'createdAt'
  const effectiveSortDirection = sortColumn == null ? 'desc' : sortDirection
  const direction = effectiveSortDirection === 'asc' ? 1 : -1

  return [...rows].sort((left, right) => {
    let comparison = 0

    switch (effectiveSortColumn) {
      case 'createdAt':
        comparison = compareCreatedAt(left.createdAt, right.createdAt)
        break
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

  return false
}

export function isSupportDocumentColumnFilterActive(
  column: SupportDocumentSortColumn,
  filters: SupportDocumentColumnFilters,
  selectedSupplierNits: string[],
): boolean {
  switch (column) {
    case 'date':
      return columnFilterIsActive(filters, 'dates')
    case 'supplier':
      return selectedSupplierNits.length > 0
    case 'siigoNumber':
      return columnFilterIsActive(filters, 'siigoNumbers')
    case 'status':
      return columnFilterIsActive(filters, 'statuses')
    default:
      return false
  }
}

export function clearSupportDocumentColumnFilter(
  column: SupportDocumentSortColumn,
  filters: SupportDocumentColumnFilters,
): SupportDocumentColumnFilters {
  switch (column) {
    case 'date':
      return { ...filters, dates: [] }
    case 'siigoNumber':
      return { ...filters, siigoNumbers: [] }
    case 'status':
      return { ...filters, statuses: [] }
    default:
      return filters
  }
}
