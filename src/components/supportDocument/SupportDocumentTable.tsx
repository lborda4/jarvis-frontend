import type { SiigoAccountOption } from '../../constants/siigoAccountCatalog'
import type { SiigoPaymentMethodOption } from '../../constants/siigoPaymentMethodCatalog'
import type { SiigoTaxOption } from '../../constants/siigoTaxCatalog'
import type { ImportRowStatus } from '../../types/import'
import { IMPORT_ROW_STATUS } from '../../types/import'
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
  formatSupportDocumentTableSupplierDocument,
} from '../../utils/formatSupportDocumentTableDisplay'
import { normalizeStatusClass } from '../../utils/formatters'

interface SupportDocumentTableProps {
  rows: SupportDocumentRow[]
  selectedIds: Set<string>
  rowDates: Record<string, string>
  rowAccounts: Record<string, SiigoAccountOption | null>
  rowPaymentMethods: Record<string, SiigoPaymentMethodOption | null>
  rowRetentions: Record<string, SiigoTaxOption[]>
  isLoading?: boolean
  isResuming?: boolean
  isSending?: boolean
  selectionDisabled?: boolean
  canSendRow: (rowId: string) => boolean
  onToggleRow: (id: string) => void
  onSelectRows: (ids: string[]) => void
  onContinueSupplier: (document: ElectronicDocumentListItem) => void
  onSendDocument: (document: ElectronicDocumentListItem) => void
  documentsById: Record<string, ElectronicDocumentListItem>
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

function ActionButton({
  action,
  disabled = false,
  onClick,
}: {
  action: SupportDocumentAction
  disabled?: boolean
  onClick?: () => void
}) {
  if (action === 'none') {
    return (
      <span className="support-table__action support-table__action--completed">
        Completado
      </span>
    )
  }

  const label = action === 'continue_supplier' ? 'Crear proveedor' : 'Enviar'

  return (
    <button
      type="button"
      className="support-table__action support-table__action--primary"
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </button>
  )
}

function SupportDocumentTable({
  rows,
  selectedIds,
  rowDates,
  rowAccounts,
  rowPaymentMethods,
  rowRetentions,
  isLoading = false,
  isResuming = false,
  isSending = false,
  selectionDisabled = false,
  canSendRow,
  onToggleRow,
  onSelectRows,
  onContinueSupplier,
  onSendDocument,
  documentsById,
}: SupportDocumentTableProps) {
  if (isLoading) {
    return (
      <div className="support-table support-table--loading">
        <span className="loading-indicator__spinner" aria-hidden="true" />
        <p>Cargando documentos...</p>
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="support-table support-table--empty">
        <p>No se encontraron documentos con los filtros actuales.</p>
      </div>
    )
  }

  const visibleIds = rows.map((row) => row.id)
  const selectedVisibleCount = visibleIds.filter((id) => selectedIds.has(id)).length
  const allVisibleSelected =
    rows.length > 0 && selectedVisibleCount === rows.length
  const someVisibleSelected =
    selectedVisibleCount > 0 && selectedVisibleCount < rows.length

  const handleSelectAllChange = () => {
    if (allVisibleSelected) {
      const remainingSelection = [...selectedIds].filter(
        (id) => !visibleIds.includes(id),
      )
      onSelectRows(remainingSelection)
      return
    }

    onSelectRows([...new Set([...selectedIds, ...visibleIds])])
  }

  return (
    <div className="support-table">
      <table>
        <thead>
          <tr>
            <th className="support-table__checkbox-col">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                ref={(input) => {
                  if (input) {
                    input.indeterminate = someVisibleSelected
                  }
                }}
                onChange={handleSelectAllChange}
                disabled={selectionDisabled}
                aria-label="Seleccionar todos los documentos visibles"
              />
            </th>
            <th>Fecha</th>
            <th>Proveedor</th>
            <th>Cuenta contable</th>
            <th>Medio de pago</th>
            <th>Retenciones</th>
            <th>Estado</th>
            <th>Acción</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const document = documentsById[row.id]
            const isProcessing = row.importStatus === IMPORT_ROW_STATUS.EN_PROCESO
            const isSendAction = row.action === 'send'
            const actionDisabled =
              isResuming ||
              isSending ||
              isProcessing ||
              (isSendAction && !canSendRow(row.id))

            const handleAction = () => {
              if (!document) return

              if (row.action === 'continue_supplier') {
                onContinueSupplier(document)
                return
              }

              if (row.action === 'send') {
                void onSendDocument(document)
              }
            }

            return (
              <tr
                key={row.id}
                className={[
                  isProcessing ? 'support-table__row--processing' : '',
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
                    disabled={selectionDisabled}
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
                      {formatSupportDocumentTableSupplierDocument(row.supplierNit)}
                    </span>
                  </div>
                </td>
                <td className="support-table__cell-config">
                  {formatSupportDocumentTableAccount(rowAccounts[row.id])}
                </td>
                <td className="support-table__cell-config">
                  {formatSupportDocumentTablePaymentMethod(rowPaymentMethods[row.id])}
                </td>
                <td className="support-table__cell-config">
                  {formatSupportDocumentTableRetentions(rowRetentions[row.id])}
                </td>
                <td>
                  <ImportStatusBadge status={row.importStatus} />
                </td>
                <td>
                  <ActionButton
                    action={row.action}
                    disabled={actionDisabled}
                    onClick={handleAction}
                  />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default SupportDocumentTable
