import AuthCompanyDisplay from './AuthCompanyDisplay'
import type { ElectronicDocumentListFilters } from '../types/electronicDocument'
import { DOCUMENT_STATUS_FILTER_OPTIONS } from '../utils/documentStatus'

interface DocumentDashboardFiltersProps {
  filters: ElectronicDocumentListFilters
  disabled?: boolean
  onFilterChange: <K extends keyof ElectronicDocumentListFilters>(
    key: K,
    value: ElectronicDocumentListFilters[K],
  ) => void
  onReset: () => void
}

function DocumentDashboardFilters({
  filters,
  disabled = false,
  onFilterChange,
  onReset,
}: DocumentDashboardFiltersProps) {
  return (
    <section className="document-dashboard-filters">
      <AuthCompanyDisplay />

      <div className="document-dashboard-filters__field document-dashboard-filters__field--search">
        <label htmlFor="document-search">Buscar</label>
        <input
          id="document-search"
          type="search"
          placeholder="CUFE, factura, NIT o proveedor"
          value={filters.search}
          onChange={(event) => onFilterChange('search', event.target.value)}
          disabled={disabled}
        />
      </div>

      <div className="document-dashboard-filters__field">
        <label htmlFor="document-status">Estado</label>
        <select
          id="document-status"
          value={filters.status}
          onChange={(event) => onFilterChange('status', event.target.value)}
          disabled={disabled}
        >
          {DOCUMENT_STATUS_FILTER_OPTIONS.map((option) => (
            <option key={option.value || 'all'} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="document-dashboard-filters__field">
        <label htmlFor="document-date-from">Fecha desde</label>
        <input
          id="document-date-from"
          type="date"
          value={filters.dateFrom}
          onChange={(event) => onFilterChange('dateFrom', event.target.value)}
          disabled={disabled}
        />
      </div>

      <div className="document-dashboard-filters__field">
        <label htmlFor="document-date-to">Fecha hasta</label>
        <input
          id="document-date-to"
          type="date"
          value={filters.dateTo}
          onChange={(event) => onFilterChange('dateTo', event.target.value)}
          disabled={disabled}
        />
      </div>

      <button
        type="button"
        className="document-dashboard-filters__reset"
        onClick={onReset}
        disabled={disabled}
      >
        Limpiar filtros
      </button>
    </section>
  )
}

export default DocumentDashboardFilters
