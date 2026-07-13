import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ExtractInvoicesResponse, InvoiceTableFilters } from '../types/invoice'
import { DEFAULT_INVOICE_TABLE_FILTERS } from '../types/invoice'
import type { InvoiceTableRow } from '../types/import'
import { getDocumentTypeOptions } from '../utils/normalizeInvoicesResponse'

function buildGroupOptions(rows: InvoiceTableRow[]): string[] {
  return [...new Set(rows.map((row) => row.group).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b, 'es'),
  )
}

function matchesSearch(row: InvoiceTableRow, search: string): boolean {
  const normalizedSearch = search.trim().toLowerCase()

  if (!normalizedSearch) return true

  const searchableValues = [
    row.issuerName,
    row.receiverName,
    row.issuerNit,
    row.receiverNit,
  ]

  return searchableValues.some((value) =>
    (value ?? '').toLowerCase().includes(normalizedSearch),
  )
}

export function useInvoiceFilters(
  data: ExtractInvoicesResponse | null,
  rows: InvoiceTableRow[],
) {
  const [filters, setFilters] = useState<InvoiceTableFilters>(
    DEFAULT_INVOICE_TABLE_FILTERS,
  )

  const documentTypeOptions = useMemo(
    () => getDocumentTypeOptions(data, rows),
    [data, rows],
  )
  const groupOptions = useMemo(() => buildGroupOptions(rows), [rows])

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (filters.documentType && row.documentType !== filters.documentType) {
        return false
      }

      if (filters.group && row.group !== filters.group) {
        return false
      }

      return matchesSearch(row, filters.search)
    })
  }, [rows, filters])

  useEffect(() => {
    setFilters(DEFAULT_INVOICE_TABLE_FILTERS)
  }, [data])

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_INVOICE_TABLE_FILTERS)
  }, [])

  const updateFilter = useCallback(
    <K extends keyof InvoiceTableFilters>(
      key: K,
      value: InvoiceTableFilters[K],
    ) => {
      setFilters((current) => ({ ...current, [key]: value }))
    },
    [],
  )

  return {
    filters,
    filteredRows,
    documentTypeOptions,
    groupOptions,
    resetFilters,
    updateFilter,
  }
}
