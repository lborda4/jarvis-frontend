import { IMPORT_ROW_STATUS, type ImportRowStatus } from '../../types/import'
import { formatSupportDocumentTableDate } from '../../utils/formatSupportDocumentTableDisplay'
import type { ElectronicDocumentFilterOptions } from '../../types/electronicDocument'

export interface ColumnCheckboxFilterOption<T extends string> {
  value: T
  label: string
}

function ColumnCheckboxFilter<T extends string>({
  options,
  selectedValues,
  disabled,
  onToggle,
}: {
  options: ColumnCheckboxFilterOption<T>[]
  selectedValues: T[]
  disabled?: boolean
  onToggle: (value: T) => void
}) {
  if (options.length === 0) {
    return (
      <p className="support-table__column-filter-empty">
        No hay valores disponibles.
      </p>
    )
  }

  const selectedSet = new Set(selectedValues)

  return (
    <div className="support-table__column-option-filters">
      {options.map((option) => (
        <label
          key={option.value}
          className="support-table__column-status-option"
        >
          <input
            type="checkbox"
            checked={selectedSet.has(option.value)}
            disabled={disabled}
            onChange={() => onToggle(option.value)}
          />
          <span>{option.label}</span>
        </label>
      ))}
    </div>
  )
}

export function buildSupportDocumentFilterOptions(
  filterOptions: ElectronicDocumentFilterOptions | null,
  /** Factura de compra SIIGO: "Requiere revisión" y "Existente en SIIGO" son
   * estados que solo existen en el frontend (se derivan de datos del
   * documento, ver mapDocumentToImportRowStatus y pageTableRows en
   * SupportDocumentPage.tsx) — el backend no los conoce, así que nunca
   * vienen en filterOptions.importStatuses y hay que agregarlos a mano acá
   * cuando aplica. */
  includePurchaseInvoiceDerivedStatuses = false,
): {
  dates: ColumnCheckboxFilterOption<string>[]
  siigoNumbers: ColumnCheckboxFilterOption<string>[]
  statuses: ColumnCheckboxFilterOption<ImportRowStatus>[]
} {
  if (!filterOptions) {
    return {
      dates: [],
      siigoNumbers: [],
      statuses: [],
    }
  }

  const statuses: ColumnCheckboxFilterOption<ImportRowStatus>[] =
    filterOptions.importStatuses.map((status) => ({
      value: status as ImportRowStatus,
      label: status,
    }))

  if (includePurchaseInvoiceDerivedStatuses) {
    for (const derivedStatus of [
      IMPORT_ROW_STATUS.REQUIERE_REVISION,
      IMPORT_ROW_STATUS.EXISTENTE_EN_SIIGO,
    ]) {
      if (!statuses.some((option) => option.value === derivedStatus)) {
        statuses.push({ value: derivedStatus, label: derivedStatus })
      }
    }
  }

  return {
    dates: filterOptions.issueDates.map((issueDate) => ({
      value: issueDate,
      label: formatSupportDocumentTableDate(issueDate),
    })),
    siigoNumbers: filterOptions.siigoDocumentNumbers.map((siigoNumber) => ({
      value: String(siigoNumber),
      label: String(siigoNumber),
    })),
    statuses,
  }
}

export default ColumnCheckboxFilter
