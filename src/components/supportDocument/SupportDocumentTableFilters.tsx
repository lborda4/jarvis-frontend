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

const DERIVED_STATUSES = [
  IMPORT_ROW_STATUS.REQUIERE_REVISION,
  IMPORT_ROW_STATUS.EXISTENTE_EN_SIIGO,
] as const

export function buildSupportDocumentFilterOptions(
  filterOptions: ElectronicDocumentFilterOptions | null,
  /** Estados que se ven en alguna fila de la página cargada. Solo decide si
   * se ofrecen los DOS estados derivados ("Requiere revisión", "Existente en
   * SIIGO"), que no existen en el backend porque se calculan en el frontend
   * a partir de los datos del documento (ver pageTableRows en
   * SupportDocumentPage.tsx) y por eso no se pueden conocer más allá de la
   * página cargada.
   *
   * `null` los deja fuera del desplegable. */
  visibleStatuses: ReadonlySet<ImportRowStatus> | null = null,
  /** Un estado ya marcado siempre se ofrece, aunque no quede ninguna fila
   * con él: si no, la selección vigente desaparecería del desplegable y no
   * habría forma de desmarcarla. */
  selectedStatuses: readonly ImportRowStatus[] = [],
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

  const isOfferable = (status: ImportRowStatus) =>
    visibleStatuses === null ||
    visibleStatuses.has(status) ||
    selectedStatuses.includes(status)

  // Los estados del backend salen de un DISTINCT sobre TODOS los documentos
  // de la empresa, así que se ofrecen tal cual: recortarlos con lo que se ve
  // en la página actual escondía, por ejemplo, un "Pendiente" que solo
  // existía en la página 2 (bug reportado).
  const statuses: ColumnCheckboxFilterOption<ImportRowStatus>[] =
    filterOptions.importStatuses.map((status) => ({
      value: status as ImportRowStatus,
      label: status,
    }))

  for (const derivedStatus of DERIVED_STATUSES) {
    if (
      visibleStatuses !== null &&
      isOfferable(derivedStatus) &&
      !statuses.some((option) => option.value === derivedStatus)
    ) {
      statuses.push({ value: derivedStatus, label: derivedStatus })
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
