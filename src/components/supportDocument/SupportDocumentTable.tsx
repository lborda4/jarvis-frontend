import { useState } from 'react'
import SupplierMultiSelect from '../SupplierMultiSelect'
import SupportDocumentColumnHeader from './SupportDocumentColumnHeader'
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
import { columnFilterIsActive } from '../../utils/filterSupportDocumentRows'
import { normalizeStatusClass } from '../../utils/formatters'
import { isSupportDocumentRowSelectable } from '../../utils/mapImportRowStatus'

interface SupportDocumentTableProps {
  rows: SupportDocumentRow[]
  selectedIds: Set<string>
  rowDates: Record<string, string>
  rowAccounts: Record<string, SiigoAccountOption | null>
  rowPaymentMethods: Record<string, SiigoPaymentMethodOption | null>
  rowRetentions: Record<string, SiigoTaxOption[]>
  supplierOptions: SupplierOption[]
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
  onToggleRow: (id: string) => void
  onSelectRows: (ids: string[]) => void
  onSendDocument: (document: ElectronicDocumentListItem) => void
  onSupplierNitsChange: (nits: string[]) => void
  onColumnFiltersChange: (
    updater: (current: SupportDocumentColumnFilters) => SupportDocumentColumnFilters,
  ) => void
  onSortChange: (column: SupportDocumentSortColumn) => void
  documentsById: Record<string, ElectronicDocumentListItem>
}

type FilterColumnKey =
  | 'date'
  | 'supplier'
  | 'siigoNumber'
  | 'account'
  | 'paymentMethod'
  | 'retentions'
  | 'status'

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
}: {
  action: SupportDocumentAction
  disabled?: boolean
  onClick?: () => void
  isSendingDocument?: boolean
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
        {isSendingDocument
          ? 'Enviando documento soporte a SIIGO...'
          : 'Procesando documento...'}
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

function ColumnTextFilter({
  value,
  placeholder,
  disabled,
  onChange,
}: {
  value: string
  placeholder: string
  disabled?: boolean
  onChange: (value: string) => void
}) {
  return (
    <input
      type="search"
      className="support-table__column-filter-input"
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      autoComplete="off"
    />
  )
}

function SupportDocumentTable({
  rows,
  selectedIds,
  rowDates,
  rowAccounts,
  rowPaymentMethods,
  rowRetentions,
  supplierOptions,
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
  onToggleRow,
  onSelectRows,
  onSendDocument,
  onSupplierNitsChange,
  onColumnFiltersChange,
  onSortChange,
  documentsById,
}: SupportDocumentTableProps) {
  const [openFilterColumn, setOpenFilterColumn] =
    useState<FilterColumnKey | null>(null)

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

  const toggleFilter = (column: FilterColumnKey) => {
    setOpenFilterColumn((current) => (current === column ? null : column))
  }

  const updateTextFilter = (
    key: keyof Pick<
      SupportDocumentColumnFilters,
      'date' | 'siigoNumber' | 'account' | 'paymentMethod' | 'retentions'
    >,
    value: string,
  ) => {
    onColumnFiltersChange((current) => ({
      ...current,
      [key]: value,
    }))
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
              isFilterActive={columnFilterIsActive(columnFilters, 'date')}
              isFilterOpen={openFilterColumn === 'date'}
              disabled={filtersDisabled}
              onSort={onSortChange}
              onToggleFilter={() => toggleFilter('date')}
              onCloseFilter={() => setOpenFilterColumn(null)}
            >
              <ColumnTextFilter
                value={columnFilters.date}
                placeholder="Filtrar fecha..."
                disabled={filtersDisabled}
                onChange={(value) => updateTextFilter('date', value)}
              />
            </SupportDocumentColumnHeader>

            <SupportDocumentColumnHeader
              label="Proveedor"
              sortColumn="supplier"
              activeSortColumn={sortColumn}
              sortDirection={sortDirection}
              isFilterActive={selectedSupplierNits.length > 0}
              isFilterOpen={openFilterColumn === 'supplier'}
              disabled={filtersDisabled}
              onSort={onSortChange}
              onToggleFilter={() => toggleFilter('supplier')}
              onCloseFilter={() => setOpenFilterColumn(null)}
            >
              <SupplierMultiSelect
                options={supplierOptions}
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
              isFilterActive={columnFilterIsActive(columnFilters, 'siigoNumber')}
              isFilterOpen={openFilterColumn === 'siigoNumber'}
              disabled={filtersDisabled}
              onSort={onSortChange}
              onToggleFilter={() => toggleFilter('siigoNumber')}
              onCloseFilter={() => setOpenFilterColumn(null)}
            >
              <ColumnTextFilter
                value={columnFilters.siigoNumber}
                placeholder="Filtrar consecutivo..."
                disabled={filtersDisabled}
                onChange={(value) => updateTextFilter('siigoNumber', value)}
              />
            </SupportDocumentColumnHeader>

            <SupportDocumentColumnHeader
              label="Cuenta contable"
              sortColumn="account"
              activeSortColumn={sortColumn}
              sortDirection={sortDirection}
              isFilterActive={columnFilterIsActive(columnFilters, 'account')}
              isFilterOpen={openFilterColumn === 'account'}
              disabled={filtersDisabled}
              onSort={onSortChange}
              onToggleFilter={() => toggleFilter('account')}
              onCloseFilter={() => setOpenFilterColumn(null)}
            >
              <ColumnTextFilter
                value={columnFilters.account}
                placeholder="Filtrar cuenta..."
                disabled={filtersDisabled}
                onChange={(value) => updateTextFilter('account', value)}
              />
            </SupportDocumentColumnHeader>

            <SupportDocumentColumnHeader
              label="Medio de pago"
              stackLabel
              sortColumn="paymentMethod"
              activeSortColumn={sortColumn}
              sortDirection={sortDirection}
              isFilterActive={columnFilterIsActive(columnFilters, 'paymentMethod')}
              isFilterOpen={openFilterColumn === 'paymentMethod'}
              disabled={filtersDisabled}
              onSort={onSortChange}
              onToggleFilter={() => toggleFilter('paymentMethod')}
              onCloseFilter={() => setOpenFilterColumn(null)}
            >
              <ColumnTextFilter
                value={columnFilters.paymentMethod}
                placeholder="Filtrar medio de pago..."
                disabled={filtersDisabled}
                onChange={(value) => updateTextFilter('paymentMethod', value)}
              />
            </SupportDocumentColumnHeader>

            <SupportDocumentColumnHeader
              label="Retenciones"
              sortColumn="retentions"
              activeSortColumn={sortColumn}
              sortDirection={sortDirection}
              isFilterActive={columnFilterIsActive(columnFilters, 'retentions')}
              isFilterOpen={openFilterColumn === 'retentions'}
              disabled={filtersDisabled}
              onSort={onSortChange}
              onToggleFilter={() => toggleFilter('retentions')}
              onCloseFilter={() => setOpenFilterColumn(null)}
            >
              <ColumnTextFilter
                value={columnFilters.retentions}
                placeholder="Filtrar retenciones..."
                disabled={filtersDisabled}
                onChange={(value) => updateTextFilter('retentions', value)}
              />
            </SupportDocumentColumnHeader>

            <SupportDocumentColumnHeader
              label="Estado"
              sortColumn="status"
              activeSortColumn={sortColumn}
              sortDirection={sortDirection}
              isFilterActive={columnFilterIsActive(columnFilters, 'statuses')}
              isFilterOpen={openFilterColumn === 'status'}
              disabled={filtersDisabled}
              onSort={onSortChange}
              onToggleFilter={() => toggleFilter('status')}
              onCloseFilter={() => setOpenFilterColumn(null)}
            >
              <div className="support-table__column-status-filters">
                {Object.values(IMPORT_ROW_STATUS).map((status) => (
                  <label
                    key={status}
                    className="support-table__column-status-option"
                  >
                    <input
                      type="checkbox"
                      checked={columnFilters.statuses.includes(status)}
                      disabled={filtersDisabled}
                      onChange={() => toggleStatusFilter(status)}
                    />
                    <span>{status}</span>
                  </label>
                ))}
              </div>
            </SupportDocumentColumnHeader>

            <th className="support-table__column-header support-table__column-header--plain">
              <span className="support-table__column-label-text">Acción</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={9} className="support-table__empty-cell">
                No se encontraron documentos con los filtros actuales.
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const document = documentsById[row.id]
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

              return (
                <tr
                  key={row.id}
                  className={[
                    isProcessing ? 'support-table__row--processing' : '',
                    !isRowSelectable ? 'support-table__row--locked' : '',
                    selectedIds.has(row.id) ? 'support-table__row--selected' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
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
                    />
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}

export default SupportDocumentTable
