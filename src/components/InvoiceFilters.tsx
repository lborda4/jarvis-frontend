import type { InvoiceTableFilters } from '../types/invoice'

interface InvoiceFiltersProps {
  filters: InvoiceTableFilters
  documentTypeOptions: string[]
  groupOptions: string[]
  onFilterChange: <K extends keyof InvoiceTableFilters>(
    key: K,
    value: InvoiceTableFilters[K],
  ) => void
  onReset: () => void
}

function InvoiceFilters({
  filters,
  documentTypeOptions,
  groupOptions,
  onFilterChange,
  onReset,
}: InvoiceFiltersProps) {
  const hasActiveFilters =
    filters.search !== '' ||
    filters.documentType !== '' ||
    filters.group !== ''

  return (
    <div className="invoice-filters">
      <div className="invoice-filters__field invoice-filters__field--search">
        <label htmlFor="invoice-search">Buscar emisor o receptor</label>
        <input
          id="invoice-search"
          type="search"
          placeholder="Nombre o NIT..."
          value={filters.search}
          onChange={(event) => onFilterChange('search', event.target.value)}
        />
      </div>

      <div className="invoice-filters__field">
        <label htmlFor="invoice-document-type">Tipo documento</label>
        <select
          id="invoice-document-type"
          value={filters.documentType}
          onChange={(event) => onFilterChange('documentType', event.target.value)}
        >
          <option value="">Todos</option>
          {documentTypeOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      <div className="invoice-filters__field">
        <label htmlFor="invoice-group">Grupo</label>
        <select
          id="invoice-group"
          value={filters.group}
          onChange={(event) => onFilterChange('group', event.target.value)}
        >
          <option value="">Todos</option>
          {groupOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      {hasActiveFilters && (
        <button
          type="button"
          className="invoice-filters__reset"
          onClick={onReset}
        >
          Limpiar filtros
        </button>
      )}
    </div>
  )
}

export default InvoiceFilters
