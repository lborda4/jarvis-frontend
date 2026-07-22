import { useMemo, useState } from 'react'
import SupplierMultiSelect from '../SupplierMultiSelect'
import SupportDocumentColumnHeader from './SupportDocumentColumnHeader'
import ColumnCheckboxFilter, {
  buildSupportDocumentFilterOptions,
} from './SupportDocumentTableFilters'
import type { ElectronicDocumentFilterOptions } from '../../types/electronicDocument'
import type { SiigoAccountOption } from '../../constants/siigoAccountCatalog'
import type { SiigoPaymentMethodOption } from '../../constants/siigoPaymentMethodCatalog'
import type { SiigoTaxOption } from '../../constants/siigoTaxCatalog'
import type { ImportRowStatus } from '../../types/import'
import { IMPORT_ROW_STATUS } from '../../types/import'
import type { SupplierOption } from '../../types/supplier'
import type {
  SupportDocumentColumnFilters,
  SupportDocumentSortColumn,
  SupportDocumentSortDirection,
} from '../../types/supportDocumentTableFilters'
import type {
  SupportDocumentAction,
  SupportDocumentRow,
} from '../../types/supportDocumentPage'
import type { ElectronicDocumentListItem } from '../../types/electronicDocument'
import {
  formatSupportDocumentTableAccount,
  formatSupportDocumentTableDate,
  formatSupportDocumentTablePaymentMethod,
  formatSupportDocumentTableRetentions,
  formatSupportDocumentTableSiigoNumber,
  formatSupportDocumentTableSupplierDocument,
} from '../../utils/formatSupportDocumentTableDisplay'
import {
  columnFilterIsActive,
  isSupportDocumentColumnFilterActive,
} from '../../utils/filterSupportDocumentRows'
import { normalizeStatusClass } from '../../utils/formatters'
import { isSupportDocumentRowSelectable } from '../../utils/mapImportRowStatus'
import DocumentRowDetailPanel from './DocumentRowDetailPanel'

const TABLE_COLUMN_COUNT = 10

interface SupportDocumentTableProps {
  rows: SupportDocumentRow[]
  filterOptions: ElectronicDocumentFilterOptions | null
  selectedIds: Set<string>
  rowDates: Record<string, string>
  rowAccounts: Record<string, SiigoAccountOption | null>
  rowPaymentMethods: Record<string, SiigoPaymentMethodOption | null>
  rowRetentions: Record<string, SiigoTaxOption[]>
  selectedSupplierNits: string[]
  columnFilters: SupportDocumentColumnFilters
  sortColumn: SupportDocumentSortColumn | null
  sortDirection: SupportDocumentSortDirection
  isLoading?: boolean
  isResuming?: boolean
  isSending?: boolean
  selectionDisabled?: boolean
  filtersDisabled?: boolean
  canSendRow: (rowId: string) => boolean
  sendProcessingLabel?: string
  onToggleRow: (id: string) => void
  onSelectRows: (ids: string[]) => void
  onSendDocument: (document: ElectronicDocumentListItem) => void
  onSupplierNitsChange: (nits: string[]) => void
  onColumnFiltersChange: (
    updater: (current: SupportDocumentColumnFilters) => SupportDocumentColumnFilters,
  ) => void
  onColumnHeaderClick: (column: SupportDocumentSortColumn) => void
  onSortChange: (column: SupportDocumentSortColumn) => void
  documentsById: Record<string, ElectronicDocumentListItem>
}

type FilterColumnKey = 'date' | 'supplier' | 'siigoNumber' | 'status'

const FILTER_COLUMN_TO_SORT: Record<
  FilterColumnKey,
  SupportDocumentSortColumn
> = {
  date: 'date',
  supplier: 'supplier',
  siigoNumber: 'siigoNumber',
  status: 'status',
}

function ImportStatusBadge({ status }: { status: ImportRowStatus }) {
  return (
    <span
      className={`status-badge status-badge--${normalizeStatusClass(status)}`}
    >
      {status}
    </span>
  )
}

function ActionCell({
  action,
  disabled = false,
  onClick,
  isSendingDocument = false,
  sendProcessingLabel = 'Enviando documento a SIIGO...',
}: {
  action: SupportDocumentAction
  disabled?: boolean
  onClick?: () => void
  isSendingDocument?: boolean
  sendProcessingLabel?: string
}) {
  if (action === 'supplier_missing') {
    return (
      <span className="support-table__action support-table__action--hint">
        Debe crear el proveedor en SIIGO
      </span>
    )
  }

  if (action === 'processing') {
    return (
      <span className="support-table__action support-table__action--hint">
        {isSendingDocument ? sendProcessingLabel : 'Procesando documento...'}
      </span>
    )
  }

  if (action === 'none') {
    return (
      <span className="support-table__action support-table__action--completed">
        Completado
      </span>
    )
  }

  return (
    <button
      type="button"
      className="support-table__action support-table__action--primary"
      disabled={disabled}
      onClick={onClick}
    >
      Enviar
    </button>
  )
}

function buildSupplierFilterOptions(
  filterOptions: ElectronicDocumentFilterOptions | null,
): SupplierOption[] {
  if (!filterOptions) {
    return []
  }

  return filterOptions.suppliers.map((supplier) => ({
    nit: supplier.nit,
    name: supplier.name,
  }))
}

function SupportDocumentTable({
  rows,
  filterOptions,
  selectedIds,
  rowDates,
  rowAccounts,
  rowPaymentMethods,
  rowRetentions,
  selectedSupplierNits,
  columnFilters,
  sortColumn,
  sortDirection,
  isLoading = false,
  isResuming = false,
  isSending = false,
  selectionDisabled = false,
  filtersDisabled = false,
  canSendRow,
  sendProcessingLabel,
  onToggleRow,
  onSelectRows,
  onSendDocument,
  onSupplierNitsChange,
  onColumnFiltersChange,
  onColumnHeaderClick,
  onSortChange,
  documentsById,
}: SupportDocumentTableProps) {
  const [openFilterColumn, setOpenFilterColumn] =
    useState<FilterColumnKey | null>(null)
  const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(new Set())

  const columnFilterOptions = useMemo(
    () => buildSupportDocumentFilterOptions(filterOptions),
    [filterOptions],
  )
  const supplierFilterOptions = useMemo(
    () => buildSupplierFilterOptions(filterOptions),
    [filterOptions],
  )

  const selectableVisibleIds = rows
    .filter((row) => isSupportDocumentRowSelectable(row.importStatus))
    .map((row) => row.id)
  const selectedSelectableCount = selectableVisibleIds.filter((id) =>
    selectedIds.has(id),
  ).length
  const allSelectableSelected =
    selectableVisibleIds.length > 0 &&
    selectedSelectableCount === selectableVisibleIds.length
  const someSelectableSelected =
    selectedSelectableCount > 0 &&
    selectedSelectableCount < selectableVisibleIds.length

  const handleSelectAllChange = () => {
    if (allSelectableSelected) {
      const remainingSelection = [...selectedIds].filter(
        (id) => !selectableVisibleIds.includes(id),
      )
      onSelectRows(remainingSelection)
      return
    }

    onSelectRows([...new Set([...selectedIds, ...selectableVisibleIds])])
  }

  const handleFilterableColumnHeaderClick = (
    column: SupportDocumentSortColumn,
  ) => {
    setOpenFilterColumn(null)
    onColumnHeaderClick(column)
  }

  const toggleFilter = (column: FilterColumnKey) => {
    const sortColumn = FILTER_COLUMN_TO_SORT[column]

    if (
      isSupportDocumentColumnFilterActive(
        sortColumn,
        columnFilters,
        selectedSupplierNits,
      )
    ) {
      handleFilterableColumnHeaderClick(sortColumn)
      return
    }

    setOpenFilterColumn((current) => (current === column ? null : column))
  }

  const toggleDateFilter = (date: string) => {
    onColumnFiltersChange((current) => {
      const nextDates = current.dates.includes(date)
        ? current.dates.filter((value) => value !== date)
        : [...current.dates, date]

      return {
        ...current,
        dates: nextDates,
      }
    })
  }

  const toggleSiigoNumberFilter = (siigoNumber: string) => {
    onColumnFiltersChange((current) => {
      const nextSiigoNumbers = current.siigoNumbers.includes(siigoNumber)
        ? current.siigoNumbers.filter((value) => value !== siigoNumber)
        : [...current.siigoNumbers, siigoNumber]

      return {
        ...current,
        siigoNumbers: nextSiigoNumbers,
      }
    })
  }

  const toggleStatusFilter = (status: ImportRowStatus) => {
    onColumnFiltersChange((current) => {
      const nextStatuses = current.statuses.includes(status)
        ? current.statuses.filter((value) => value !== status)
        : [...current.statuses, status]

      return {
        ...current,
        statuses: nextStatuses,
      }
    })
  }

  const toggleRowExpanded = (rowId: string) => {
    setExpandedRowIds((current) => {
      const next = new Set(current)

      if (next.has(rowId)) {
        next.delete(rowId)
      } else {
        next.add(rowId)
      }

      return next
    })
  }

  if (isLoading) {
    return (
      <div className="support-table support-table--loading">
        <span className="loading-indicator__spinner" aria-hidden="true" />
        <p>Cargando documentos...</p>
      </div>
    )
  }

  return (
    <div className="support-table">
      <table>
        <thead>
          <tr>
            <th className="support-table__expand-col" aria-label="Detalle" />

            <th className="support-table__checkbox-col">
              <input
                type="checkbox"
                checked={allSelectableSelected}
                ref={(input) => {
                  if (input) {
                    input.indeterminate = someSelectableSelected
                  }
                }}
                onChange={handleSelectAllChange}
                disabled={selectionDisabled || selectableVisibleIds.length === 0}
                aria-label="Seleccionar todos los documentos visibles pendientes"
              />
            </th>

            <SupportDocumentColumnHeader
              label="Fecha"
              sortColumn="date"
              activeSortColumn={sortColumn}
              sortDirection={sortDirection}
              isFilterActive={columnFilterIsActive(columnFilters, 'dates')}
              isFilterOpen={openFilterColumn === 'date'}
              disabled={filtersDisabled}
              onHeaderClick={handleFilterableColumnHeaderClick}
              onToggleFilter={() => toggleFilter('date')}
              onCloseFilter={() => setOpenFilterColumn(null)}
            >
              <ColumnCheckboxFilter
                options={columnFilterOptions.dates}
                selectedValues={columnFilters.dates}
                disabled={filtersDisabled}
                onToggle={toggleDateFilter}
              />
            </SupportDocumentColumnHeader>

            <SupportDocumentColumnHeader
              label="Proveedor"
              sortColumn="supplier"
              activeSortColumn={sortColumn}
              sortDirection={sortDirection}
              isFilterActive={isSupportDocumentColumnFilterActive(
                'supplier',
                columnFilters,
                selectedSupplierNits,
              )}
              isFilterOpen={openFilterColumn === 'supplier'}
              disabled={filtersDisabled}
              onHeaderClick={handleFilterableColumnHeaderClick}
              onToggleFilter={() => toggleFilter('supplier')}
              onCloseFilter={() => setOpenFilterColumn(null)}
            >
              <SupplierMultiSelect
                options={supplierFilterOptions}
                selectedNits={selectedSupplierNits}
                onChange={onSupplierNitsChange}
                disabled={filtersDisabled}
                placeholder="Buscar proveedor..."
                embedded
              />
            </SupportDocumentColumnHeader>

            <SupportDocumentColumnHeader
              label="Consecutivo SIIGO"
              stackLabel
              sortColumn="siigoNumber"
              activeSortColumn={sortColumn}
              sortDirection={sortDirection}
              isFilterActive={columnFilterIsActive(
                columnFilters,
                'siigoNumbers',
              )}
              isFilterOpen={openFilterColumn === 'siigoNumber'}
              disabled={filtersDisabled}
              onHeaderClick={handleFilterableColumnHeaderClick}
              onToggleFilter={() => toggleFilter('siigoNumber')}
              onCloseFilter={() => setOpenFilterColumn(null)}
            >
              <ColumnCheckboxFilter
                options={columnFilterOptions.siigoNumbers}
                selectedValues={columnFilters.siigoNumbers}
                disabled={filtersDisabled}
                onToggle={toggleSiigoNumberFilter}
              />
            </SupportDocumentColumnHeader>

            <SupportDocumentColumnHeader
              label="Cuenta contable"
              sortColumn="account"
              activeSortColumn={sortColumn}
              sortDirection={sortDirection}
              disabled={filtersDisabled}
              onSort={onSortChange}
            />

            <SupportDocumentColumnHeader
              label="Medio de pago"
              stackLabel
              sortColumn="paymentMethod"
              activeSortColumn={sortColumn}
              sortDirection={sortDirection}
              disabled={filtersDisabled}
              onSort={onSortChange}
            />

            <SupportDocumentColumnHeader
              label="Retenciones"
              sortColumn="retentions"
              activeSortColumn={sortColumn}
              sortDirection={sortDirection}
              disabled={filtersDisabled}
              onSort={onSortChange}
            />

            <SupportDocumentColumnHeader
              label="Estado"
              sortColumn="status"
              activeSortColumn={sortColumn}
              sortDirection={sortDirection}
              isFilterActive={columnFilterIsActive(columnFilters, 'statuses')}
              isFilterOpen={openFilterColumn === 'status'}
              disabled={filtersDisabled}
              onHeaderClick={handleFilterableColumnHeaderClick}
              onToggleFilter={() => toggleFilter('status')}
              onCloseFilter={() => setOpenFilterColumn(null)}
            >
              <ColumnCheckboxFilter
                options={columnFilterOptions.statuses}
                selectedValues={columnFilters.statuses}
                disabled={filtersDisabled}
                onToggle={toggleStatusFilter}
              />
            </SupportDocumentColumnHeader>

            <th className="support-table__column-header support-table__column-header--plain">
              <span className="support-table__column-label-text">Acción</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={TABLE_COLUMN_COUNT} className="support-table__empty-cell">
                No se encontraron documentos con los filtros actuales.
              </td>
            </tr>
          ) : (
            rows.flatMap((row) => {
              const document = documentsById[row.id]
              const isExpanded = expandedRowIds.has(row.id)
              const isProcessing =
                row.importStatus === IMPORT_ROW_STATUS.EN_PROCESO
              const isRowSelectable = isSupportDocumentRowSelectable(
                row.importStatus,
              )
              const isSendAction = row.action === 'send'
              const actionDisabled =
                isResuming ||
                isSending ||
                isProcessing ||
                (isSendAction && !canSendRow(row.id))

              const handleAction = () => {
                if (!document || row.action !== 'send') return
                void onSendDocument(document)
              }

              return [
                <tr
                  key={row.id}
                  className={[
                    isProcessing ? 'support-table__row--processing' : '',
                    !isRowSelectable ? 'support-table__row--locked' : '',
                    selectedIds.has(row.id) ? 'support-table__row--selected' : '',
                    isExpanded ? 'support-table__row--expanded' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <td className="support-table__expand-col">
                    <button
                      type="button"
                      className="support-table__expand-button"
                      onClick={() => toggleRowExpanded(row.id)}
                      aria-expanded={isExpanded}
                      aria-label={
                        isExpanded
                          ? `Ocultar detalle de ${row.supplierName}`
                          : `Ver detalle de ${row.supplierName}`
                      }
                    >
                      {isExpanded ? '▾' : '▸'}
                    </button>
                  </td>
                  <td className="support-table__checkbox-col">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(row.id)}
                      onChange={() => onToggleRow(row.id)}
                      disabled={selectionDisabled || !isRowSelectable}
                      aria-label={`Seleccionar documento de ${row.supplierName}`}
                    />
                  </td>
                  <td className="support-table__cell-date">
                    {formatSupportDocumentTableDate(rowDates[row.id])}
                  </td>
                  <td>
                    <div className="support-table__supplier">
                      <span className="support-table__supplier-name">
                        {row.supplierName}
                      </span>
                      <span className="support-table__supplier-nit">
                        {formatSupportDocumentTableSupplierDocument(
                          row.supplierNit,
                        )}
                      </span>
                    </div>
                  </td>
                  <td className="support-table__cell-siigo-number">
                    {formatSupportDocumentTableSiigoNumber(
                      row.siigoDocumentNumber,
                    )}
                  </td>
                  <td className="support-table__cell-config">
                    {formatSupportDocumentTableAccount(rowAccounts[row.id])}
                  </td>
                  <td className="support-table__cell-config">
                    {formatSupportDocumentTablePaymentMethod(
                      rowPaymentMethods[row.id],
                    )}
                  </td>
                  <td className="support-table__cell-config">
                    {formatSupportDocumentTableRetentions(
                      rowRetentions[row.id],
                    )}
                  </td>
                  <td>
                    <ImportStatusBadge status={row.importStatus} />
                  </td>
                  <td>
                    <ActionCell
                      action={row.action}
                      disabled={actionDisabled}
                      onClick={handleAction}
                      isSendingDocument={isProcessing && isSending}
                      sendProcessingLabel={sendProcessingLabel}
                    />
                  </td>
                </tr>,
                isExpanded && document ? (
                  <tr
                    key={`${row.id}-detail`}
                    className="support-table__detail-row"
                  >
                    <td colSpan={TABLE_COLUMN_COUNT}>
                      <DocumentRowDetailPanel document={document} />
                    </td>
                  </tr>
                ) : null,
              ].filter(Boolean)
            })
          )}
        </tbody>
      </table>
    </div>
  )
}

export default SupportDocumentTable
