import type { ElectronicDocumentType } from '../types/electronicDocument'
import type { SupportDocumentColumnFilters } from '../types/supportDocumentTableFilters'
import { getCurrentCalendarMonthRange } from './purchaseInvoicePeriodExport'

export function hasUiElectronicDocumentFilters(
  columnFilters: SupportDocumentColumnFilters,
  selectedSupplierNits: string[],
): boolean {
  return (
    Boolean(columnFilters.referenceSearch?.trim()) ||
    selectedSupplierNits.length > 0 ||
    columnFilters.statuses.length > 0 ||
    columnFilters.siigoNumbers.length > 0 ||
    columnFilters.dates.length > 0 ||
    Boolean(columnFilters.dateFrom?.trim()) ||
    Boolean(columnFilters.dateTo?.trim())
  )
}

export interface BuildElectronicDocumentListFiltersParams {
  electronicDocumentType: ElectronicDocumentType
  columnFilters: SupportDocumentColumnFilters
  selectedSupplierNits: string[]
  page?: number
  limit?: number
  /**
   * Solo para exportar resumen: sin ningún filtro en UI, limita al mes
   * calendario actual. El listado paginado no usa este flag.
   */
  defaultToCurrentMonthWhenUnfiltered?: boolean
  referenceDate?: Date
}

export interface BuiltElectronicDocumentListFilters {
  search?: string
  electronicDocumentType: ElectronicDocumentType
  page?: number
  limit?: number
  supplierNits?: string[]
  issueDates?: string[]
  issueDateFrom?: string
  issueDateTo?: string
  siigoDocumentNumbers?: string[]
  importStatuses?: string[]
}

/** Mismos criterios que el listado; opcionalmente mes actual si no hay filtros. */
export function buildElectronicDocumentListFilters(
  params: BuildElectronicDocumentListFiltersParams,
): BuiltElectronicDocumentListFilters {
  const {
    electronicDocumentType,
    columnFilters,
    selectedSupplierNits,
    page,
    limit,
    defaultToCurrentMonthWhenUnfiltered = false,
    referenceDate = new Date(),
  } = params

  const unfiltered = !hasUiElectronicDocumentFilters(
    columnFilters,
    selectedSupplierNits,
  )

  let issueDateFrom = columnFilters.dateFrom?.trim() || undefined
  let issueDateTo = columnFilters.dateTo?.trim() || undefined

  if (unfiltered && defaultToCurrentMonthWhenUnfiltered) {
    const month = getCurrentCalendarMonthRange(referenceDate)
    issueDateFrom = month.from
    issueDateTo = month.to
  }

  return {
    electronicDocumentType,
    ...(columnFilters.referenceSearch?.trim() ? { search: columnFilters.referenceSearch.trim() } : {}),
    ...(page !== undefined ? { page } : {}),
    ...(limit !== undefined ? { limit } : {}),
    supplierNits:
      selectedSupplierNits.length > 0 ? selectedSupplierNits : undefined,
    issueDates:
      columnFilters.dates.length > 0 ? columnFilters.dates : undefined,
    issueDateFrom,
    issueDateTo,
    siigoDocumentNumbers:
      columnFilters.siigoNumbers.length > 0
        ? columnFilters.siigoNumbers
        : undefined,
    importStatuses:
      columnFilters.statuses.length > 0 ? columnFilters.statuses : undefined,
  }
}
