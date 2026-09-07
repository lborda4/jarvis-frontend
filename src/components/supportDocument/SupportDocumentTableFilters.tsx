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
  /** Estados que de verdad se ven en alguna fila cargada. El desplegable de
   * Estado se arma con ESTE set, no con filterOptions.importStatuses a secas,
   * porque los dos no son lo mismo: el backend reporta el estado GUARDADO de
   * cada documento, mientras que la tabla muestra un estado DERIVADO (ver
   * mapDocumentToImportRowStatus y pageTableRows en SupportDocumentPage.tsx).
   * Un documento guardado como "Lista" puede mostrarse como "Existente en
   * SIIGO", y uno "Pendiente" como "Requiere revisión" — así que ofrecer el
   * estado guardado llevaba a filtros que no devolvían ni una fila (bug real
   * reportado: "Lista" marcada, tabla vacía). Los dos estados derivados
   * tampoco existen en el backend, así que se agregan desde acá.
   *
   * `null` desactiva el recorte y deja pasar lo que reporte el backend. */
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

  const statuses: ColumnCheckboxFilterOption<ImportRowStatus>[] =
    filterOptions.importStatuses
      .map((status) => status as ImportRowStatus)
      .filter(isOfferable)
      .map((status) => ({ value: status, label: status }))

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
