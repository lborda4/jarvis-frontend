import type { ExtractInvoicesResponse } from '../types/invoice'
import type { InvoiceTableRow } from '../types/import'
import { formatCurrency, formatDate, normalizeStatusClass } from '../utils/formatters'
import ImportSiigoButton from './ImportSiigoButton'
import InvoiceFilters from './InvoiceFilters'
import { useInvoiceFilters } from '../hooks/useInvoiceFilters'

interface InvoiceResultsTableProps {
  data: ExtractInvoicesResponse
  rows: InvoiceTableRow[]
  selectedCufes: Set<string>
  isImporting: boolean
  title?: string
  emptyMessage?: string
  onToggleRow: (cufe: string) => void
  onSelectRows: (cufes: string[]) => void
  onImportSelected: () => void
}

function InvoiceResultsTable({
  data,
  rows,
  selectedCufes,
  isImporting,
  title = 'Facturas procesadas',
  emptyMessage,
  onToggleRow,
  onSelectRows,
  onImportSelected,
}: InvoiceResultsTableProps) {
  const {
    filters,
    filteredRows,
    documentTypeOptions,
    groupOptions,
    resetFilters,
    updateFilter,
  } = useInvoiceFilters(data, rows)

  const filteredCufes = filteredRows.map((row) => row.cufe)
  const selectedFilteredCount = filteredCufes.filter((cufe) =>
    selectedCufes.has(cufe),
  ).length
  const allFilteredSelected =
    filteredRows.length > 0 && selectedFilteredCount === filteredRows.length
  const someFilteredSelected =
    selectedFilteredCount > 0 && selectedFilteredCount < filteredRows.length

  const handleSelectAllChange = () => {
    if (allFilteredSelected) {
      const remainingSelection = [...selectedCufes].filter(
        (cufe) => !filteredCufes.includes(cufe),
      )
      onSelectRows(remainingSelection)
      return
    }

    onSelectRows([...new Set([...selectedCufes, ...filteredCufes])])
  }

  return (
    <section className="results-panel" aria-label={title}>
      <div className="results-panel__header">
        <div>
          <h2 className="results-panel__title">{title}</h2>
          <p className="results-panel__summary">
            <span>
              Total encontradas: <strong>{data.total ?? rows.length}</strong>
            </span>
            <span>
              Mostrando: <strong>{filteredRows.length}</strong>
            </span>
            <span>
              Seleccionadas: <strong>{selectedCufes.size}</strong>
            </span>
          </p>
        </div>

        <ImportSiigoButton
          selectedCount={selectedCufes.size}
          disabled={selectedCufes.size === 0}
          isLoading={isImporting}
          onClick={onImportSelected}
        />
      </div>

      <InvoiceFilters
        filters={filters}
        documentTypeOptions={documentTypeOptions}
        groupOptions={groupOptions}
        onFilterChange={updateFilter}
        onReset={resetFilters}
      />

      {filteredRows.length === 0 ? (
        <p className="results-empty">
          {emptyMessage ??
            ((data.total ?? rows.length) === 0
              ? 'El archivo se procesó correctamente, pero no se encontraron facturas.'
              : 'No hay facturas que coincidan con los filtros aplicados.')}
        </p>
      ) : (
        <div className="results-table-scroll">
          <table className="results-table">
            <thead>
              <tr>
                <th className="results-table__checkbox-header">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    ref={(input) => {
                      if (input) {
                        input.indeterminate = someFilteredSelected
                      }
                    }}
                    onChange={handleSelectAllChange}
                    disabled={isImporting}
                    aria-label="Seleccionar todas las facturas visibles"
                  />
                </th>
                <th>Tipo documento</th>
                <th>Receptor</th>
                <th>Fecha</th>
                <th>Valor</th>
                <th>Grupo</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr
                  key={row.cufe}
                  className={
                    row.importStatus === 'EN PROCESO'
                      ? 'results-table__row--processing'
                      : undefined
                  }
                >
                  <td className="results-table__checkbox-cell">
                    <input
                      type="checkbox"
                      checked={selectedCufes.has(row.cufe)}
                      onChange={() => onToggleRow(row.cufe)}
                      disabled={isImporting}
                      aria-label={`Seleccionar factura ${row.folio || row.cufe}`}
                    />
                  </td>
                  <td>{row.documentType}</td>
                  <td>
                    <span className="results-table__party-name">
                      {row.receiverName}
                    </span>
                    <span className="results-table__party-nit">
                      NIT {row.receiverNit}
                    </span>
                  </td>
                  <td>{formatDate(row.issueDate)}</td>
                  <td className="results-table__amount">
                    {formatCurrency(row.total, row.currency)}
                  </td>
                  <td>{row.group}</td>
                  <td>
                    <span
                      className={`status-badge status-badge--${normalizeStatusClass(row.importStatus)}`}
                    >
                      {row.importStatus}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export default InvoiceResultsTable
