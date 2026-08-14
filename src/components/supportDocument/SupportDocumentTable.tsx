import { useState } from 'react'
import Button from '../Button'
import { ChevronDownIcon, ChevronRightIcon } from '../icons/SidebarIcons'
import SupportDocumentColumnHeader from './SupportDocumentColumnHeader'
import type { SiigoAccountOption } from '../../constants/siigoAccountCatalog'
import type { SiigoPaymentMethodOption } from '../../constants/siigoPaymentMethodCatalog'
import type { SiigoTaxOption } from '../../constants/siigoTaxCatalog'
import { IMPORT_ROW_STATUS } from '../../types/import'
import type {
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
import { normalizeStatusClass } from '../../utils/formatters'
import { isSupportDocumentRowSelectable } from '../../utils/mapImportRowStatus'
import DocumentRowDetailPanel from './DocumentRowDetailPanel'

const TABLE_COLUMN_COUNT = 9
const SKELETON_LINE_COUNT = 8

function TableLoadingPanel() {
  return (
    <tr>
      <td colSpan={TABLE_COLUMN_COUNT} className="support-table__loading-cell">
        <div
          className="support-table__loading-panel"
          role="status"
          aria-live="polite"
          aria-busy="true"
          aria-label="Cargando documentos"
        >
          <div className="support-table__loading-lines" aria-hidden="true">
            {Array.from({ length: SKELETON_LINE_COUNT }, (_, index) => (
              <span
                key={`skeleton-line-${index}`}
                className="support-table__loading-line"
                style={{ animationDelay: `${index * 60}ms` }}
              />
            ))}
          </div>
          <p className="support-table__loading-label">Cargando documentos…</p>
        </div>
      </td>
    </tr>
  )
}

interface SupportDocumentTableProps {
  rows: SupportDocumentRow[]
  selectedIds: Set<string>
  rowDates: Record<string, string>
  rowAccounts: Record<string, SiigoAccountOption | null>
  rowPaymentMethods: Record<string, SiigoPaymentMethodOption | null>
  rowRetentions: Record<string, SiigoTaxOption[]>
  sortColumn: SupportDocumentSortColumn | null
  sortDirection: SupportDocumentSortDirection
  isLoading?: boolean
  isResuming?: boolean
  isSending?: boolean
  isDeleting?: boolean
  deletingDocumentId?: string | null
  selectionDisabled?: boolean
  sortDisabled?: boolean
  canSendRow: (rowId: string) => boolean
  sendProcessingLabel?: string
  supplierMissingLabel?: string
  onToggleRow: (id: string) => void
  onSelectRows: (ids: string[]) => void
  onSendDocument: (document: ElectronicDocumentListItem) => void
  onDeleteDocument: (document: ElectronicDocumentListItem) => void
  onCreateSupplier?: (document: ElectronicDocumentListItem) => void
  onSortChange: (column: SupportDocumentSortColumn) => void
  documentsById: Record<string, ElectronicDocumentListItem>
}

function ImportStatusBadge({
  status,
}: {
  status: SupportDocumentRow['importStatus']
}) {
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
  isDeletingDocument = false,
  sendProcessingLabel = 'Enviando documento a SIIGO...',
  supplierMissingLabel = 'Debe crear el proveedor en SIIGO',
}: {
  action: SupportDocumentAction
  disabled?: boolean
  onClick?: () => void
  isSendingDocument?: boolean
  isDeletingDocument?: boolean
  sendProcessingLabel?: string
  supplierMissingLabel?: string
}) {
  if (action === 'supplier_missing') {
    if (onClick) {
      return (
        <Button
          variant="outline"
          size="sm"
          className="support-table__action"
          disabled={disabled}
          onClick={onClick}
        >
          {supplierMissingLabel}
        </Button>
      )
    }

    return (
      <span className="support-table__action support-table__action--hint">
        {supplierMissingLabel}
      </span>
    )
  }

  if (action === 'processing') {
    return (
      <span className="support-table__action support-table__action--hint support-table__action--thinking">
        <span className="support-table__action-spinner" aria-hidden="true" />
        {isDeletingDocument
          ? 'Eliminando...'
          : isSendingDocument
            ? sendProcessingLabel
            : 'Revisando proveedor...'}
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

  if (action === 'delete') {
    return (
      <Button
        variant="outline-danger"
        size="sm"
        className="support-table__action"
        disabled={disabled}
        onClick={onClick}
      >
        Eliminar
      </Button>
    )
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="support-table__action"
      disabled={disabled}
      onClick={onClick}
    >
      Enviar
    </Button>
  )
}

function SupportDocumentTable({
  rows,
  selectedIds,
  rowDates,
  rowAccounts,
  rowPaymentMethods,
  rowRetentions,
  sortColumn,
  sortDirection,
  isLoading = false,
  isResuming = false,
  isSending = false,
  isDeleting = false,
  deletingDocumentId = null,
  selectionDisabled = false,
  sortDisabled = false,
  canSendRow,
  sendProcessingLabel,
  supplierMissingLabel = 'Debe crear el proveedor en SIIGO',
  onToggleRow,
  onSelectRows,
  onSendDocument,
  onDeleteDocument,
  onCreateSupplier,
  onSortChange,
  documentsById,
}: SupportDocumentTableProps) {
  const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(new Set())

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

  return (
    <div
      className={[
        'support-table',
        isLoading || isResuming ? 'support-table--busy' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <table aria-busy={isLoading || isResuming}>
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
                disabled={
                  selectionDisabled ||
                  isLoading ||
                  selectableVisibleIds.length === 0
                }
                aria-label="Seleccionar todos los documentos visibles"
              />
            </th>

            <SupportDocumentColumnHeader
              label="Fecha"
              sortColumn="date"
              activeSortColumn={sortColumn}
              sortDirection={sortDirection}
              disabled={sortDisabled || isLoading}
              onSort={onSortChange}
            />

            <SupportDocumentColumnHeader
              label="Proveedor"
              sortColumn="supplier"
              activeSortColumn={sortColumn}
              sortDirection={sortDirection}
              disabled={sortDisabled || isLoading}
              onSort={onSortChange}
            />

            <SupportDocumentColumnHeader
              label="Cuenta contable"
              sortColumn="account"
              activeSortColumn={sortColumn}
              sortDirection={sortDirection}
              disabled={sortDisabled || isLoading}
              onSort={onSortChange}
            />

            <SupportDocumentColumnHeader
              label="Medio de pago"
              stackLabel
              sortColumn="paymentMethod"
              activeSortColumn={sortColumn}
              sortDirection={sortDirection}
              disabled={sortDisabled || isLoading}
              onSort={onSortChange}
            />

            <SupportDocumentColumnHeader
              label="Retenciones"
              sortColumn="retentions"
              activeSortColumn={sortColumn}
              sortDirection={sortDirection}
              disabled={sortDisabled || isLoading}
              onSort={onSortChange}
            />

            <SupportDocumentColumnHeader
              label="Estado"
              sortColumn="status"
              activeSortColumn={sortColumn}
              sortDirection={sortDirection}
              disabled={sortDisabled || isLoading}
              onSort={onSortChange}
            />

            <th className="support-table__column-header support-table__column-header--plain">
              <span className="support-table__column-label-text">Acción</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <TableLoadingPanel />
          ) : rows.length === 0 ? (
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
              const isRowDeleting =
                isDeleting && deletingDocumentId === row.id
              const actionDisabled =
                isResuming ||
                isSending ||
                isDeleting ||
                isProcessing ||
                (isSendAction && !canSendRow(row.id))

              const handleAction = () => {
                if (!document) return
                if (row.action === 'send') {
                  void onSendDocument(document)
                  return
                }
                if (row.action === 'delete') {
                  void onDeleteDocument(document)
                  return
                }
                if (row.action === 'supplier_missing' && onCreateSupplier) {
                  onCreateSupplier(document)
                }
              }

              return [
                <tr
                  key={row.id}
                  className={[
                    isProcessing || isRowDeleting
                      ? 'support-table__row--processing'
                      : '',
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
                      {isExpanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
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
                    <div className="support-table__status-cell">
                      <ImportStatusBadge status={row.importStatus} />
                      {row.siigoDocumentNumber && (
                        <span className="support-table__status-consecutivo">
                          Consecutivo:{' '}
                          {formatSupportDocumentTableSiigoNumber(
                            row.siigoDocumentNumber,
                          )}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <ActionCell
                      action={isRowDeleting ? 'processing' : row.action}
                      disabled={actionDisabled}
                      onClick={
                        row.action === 'supplier_missing' && !onCreateSupplier
                          ? undefined
                          : handleAction
                      }
                      isSendingDocument={isProcessing && isSending}
                      isDeletingDocument={isRowDeleting}
                      sendProcessingLabel={sendProcessingLabel}
                      supplierMissingLabel={supplierMissingLabel}
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
