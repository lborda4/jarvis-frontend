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
import type { PurchaseInvoiceItemDraft } from '../../types/purchaseInvoiceItemDraft'
import { buildPurchaseInvoiceItemDrafts } from '../../types/purchaseInvoiceItemDraft'
import type { PurchaseInvoiceDetailEditorSave } from './PurchaseInvoiceDetailEditor'
import {
  formatSupportDocumentTableAccount,
  formatSupportDocumentTableDate,
  formatSupportDocumentTableIva,
  formatSupportDocumentTablePaymentMethod,
  formatSupportDocumentTableRetentions,
  formatSupportDocumentTableSiigoNumber,
  formatSupportDocumentTableSupplierDocument,
} from '../../utils/formatSupportDocumentTableDisplay'
import { formatCurrency, normalizeStatusClass } from '../../utils/formatters'
import { isSupportDocumentRowSelectable } from '../../utils/mapImportRowStatus'
import { calculatePurchaseInvoiceRowSummary } from '../../utils/purchaseInvoiceRowSummary'
import DocumentRowDetailPanel from './DocumentRowDetailPanel'

const TABLE_COLUMN_COUNT = 9
const SKELETON_LINE_COUNT = 8

function TableLoadingPanel({ columnCount }: { columnCount: number }) {
  return (
    <tr>
      <td colSpan={columnCount} className="support-table__loading-cell">
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
  /** Catálogo de cuentas para el buscador de cuenta contable por ítem
   * (Factura de compra, cuando el tipo del ítem es "Cuenta"). */
  accountOptions?: SiigoAccountOption[]
  rowPaymentMethods: Record<string, SiigoPaymentMethodOption | null>
  rowRetentions: Record<string, SiigoTaxOption[]>
  rowIva: Record<string, SiigoTaxOption | null>
  /** Solo aplica a Factura de compra SIIGO. */
  showIvaColumn?: boolean
  /** Factura de compra: cambia Cuenta contable/Medio de pago por
   * Subtotal/IVA($)/Retenciones($)/Total calculados, y habilita el editor
   * completo (ítems, forma de pago, plazo, retenciones) al expandir la fila. */
  showSummaryColumns?: boolean
  rowDueDates?: Record<string, string | null>
  rowObservations?: Record<string, string>
  rowItems?: Record<string, PurchaseInvoiceItemDraft[]>
  rowDocumentDiscounts?: Record<string, number>
  paymentMethodOptions?: SiigoPaymentMethodOption[]
  ivaOptions?: SiigoTaxOption[]
  retentionCatalogTypes?: readonly string[]
  retentionOptionsByType?: Record<string, SiigoTaxOption[]>
  onSaveRowEdits?: (documentId: string, edits: PurchaseInvoiceDetailEditorSave) => void
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
  accountOptions = [],
  rowPaymentMethods,
  rowRetentions,
  rowIva,
  showIvaColumn = false,
  showSummaryColumns = false,
  rowDueDates = {},
  rowObservations = {},
  rowItems = {},
  rowDocumentDiscounts = {},
  paymentMethodOptions = [],
  ivaOptions = [],
  retentionCatalogTypes = [],
  retentionOptionsByType = {},
  onSaveRowEdits,
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
  // Borrador en vivo del panel de detalle de Factura de compra (ítems,
  // retenciones, etc.) para la fila expandida — se actualiza en cada cambio,
  // no solo al guardar, así el Total de la fila colapsada (arriba) siempre
  // coincide con el "Total neto" del panel mientras se edita. Se descarta al
  // colapsar la fila por cualquier vía (Cancelar, Guardar o el chevron), ver
  // toggleRowExpanded — editar sin guardar nunca deja un rastro.
  const [liveRowEdits, setLiveRowEdits] = useState<
    Record<string, PurchaseInvoiceDetailEditorSave>
  >({})
  // Ancla para selección con Shift+click (como al seleccionar varios
  // archivos en el explorador): guarda el último checkbox clickeado para
  // poder seleccionar todo el rango entre ese y el siguiente clic.
  const [lastSelectedRowId, setLastSelectedRowId] = useState<string | null>(
    null,
  )
  const columnCount = showIvaColumn ? TABLE_COLUMN_COUNT + 1 : TABLE_COLUMN_COUNT

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

  const handleRowCheckboxClick = (
    rowId: string,
    event: React.MouseEvent<HTMLInputElement>,
  ) => {
    // El toggle nativo del checkbox se bloquea siempre (ver onClick más
    // abajo) — este handler es la única fuente de verdad para el cambio de
    // selección, tanto en click normal como con Shift. Antes se dejaba que
    // el navegador hiciera su propio toggle además de esto, y en el caso de
    // Shift+click a veces alcanzaba a disparar su propio onChange sobre la
    // fila recién agregada por el rango, quitándola de nuevo (por eso
    // desaparecía justo la última fila del rango).
    if (event.shiftKey && lastSelectedRowId && lastSelectedRowId !== rowId) {
      const lastIndex = selectableVisibleIds.indexOf(lastSelectedRowId)
      const currentIndex = selectableVisibleIds.indexOf(rowId)

      if (lastIndex !== -1 && currentIndex !== -1) {
        const [start, end] =
          lastIndex < currentIndex
            ? [lastIndex, currentIndex]
            : [currentIndex, lastIndex]
        const rangeIds = selectableVisibleIds.slice(start, end + 1)

        onSelectRows([...new Set([...selectedIds, ...rangeIds])])
        setLastSelectedRowId(rowId)
        return
      }
    }

    onToggleRow(rowId)
    setLastSelectedRowId(rowId)
  }

  const toggleRowExpanded = (rowId: string) => {
    setExpandedRowIds((current) => {
      const next = new Set(current)

      if (next.has(rowId)) {
        next.delete(rowId)
        // Se colapsa la fila (Cancelar, Guardar o el chevron) — el borrador
        // en vivo deja de aplicar. Si se guardó, rowItems/rowRetentions ya
        // quedaron actualizados aparte; si no, el borrador simplemente se
        // descarta.
        setLiveRowEdits((currentEdits) => {
          if (!(rowId in currentEdits)) {
            return currentEdits
          }

          const { [rowId]: _removed, ...rest } = currentEdits
          return rest
        })
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

            {!showSummaryColumns && (
              <SupportDocumentColumnHeader
                label="Cuenta contable"
                sortColumn="account"
                activeSortColumn={sortColumn}
                sortDirection={sortDirection}
                disabled={sortDisabled || isLoading}
                onSort={onSortChange}
              />
            )}

            {!showSummaryColumns && (
              <SupportDocumentColumnHeader
                label="Medio de pago"
                stackLabel
                sortColumn="paymentMethod"
                activeSortColumn={sortColumn}
                sortDirection={sortDirection}
                disabled={sortDisabled || isLoading}
                onSort={onSortChange}
              />
            )}

            {showSummaryColumns && (
              <th className="support-table__column-header support-table__column-header--plain">
                <span className="support-table__column-label-text">Subtotal</span>
              </th>
            )}

            {showIvaColumn && (
              <SupportDocumentColumnHeader
                label="IVA"
                sortColumn="iva"
                activeSortColumn={sortColumn}
                sortDirection={sortDirection}
                disabled={sortDisabled || isLoading}
                onSort={onSortChange}
              />
            )}

            <SupportDocumentColumnHeader
              label="Retenciones"
              sortColumn="retentions"
              activeSortColumn={sortColumn}
              sortDirection={sortDirection}
              disabled={sortDisabled || isLoading}
              onSort={onSortChange}
            />

            {showSummaryColumns && (
              <th className="support-table__column-header support-table__column-header--plain">
                <span className="support-table__column-label-text">Total</span>
              </th>
            )}

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
            <TableLoadingPanel columnCount={columnCount} />
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columnCount} className="support-table__empty-cell">
                No se encontraron documentos con los filtros actuales.
              </td>
            </tr>
          ) : (
            rows.flatMap((row) => {
              const document = documentsById[row.id]
              const liveEdits = liveRowEdits[row.id]
              // Misma expresión que se usa para armar el panel de detalle
              // más abajo (nunca `rowItems[row.id]` solo, sin este mismo
              // fallback) — así el resumen de la fila (listado) y el panel
              // de detalle de ese mismo documento SIEMPRE parten de los
              // mismos ítems y no pueden mostrar un Total distinto entre sí.
              // Mientras la fila está expandida y editándose, el borrador en
              // vivo (liveEdits) tiene prioridad, así el Total de arriba
              // sigue el "Total neto" del panel sin esperar a "Guardar".
              const effectivePurchaseInvoiceItems = document
                ? (liveEdits?.items ??
                  rowItems[row.id] ??
                  buildPurchaseInvoiceItemDrafts(document))
                : undefined
              const effectiveRetentions =
                liveEdits?.retentions ?? rowRetentions[row.id] ?? []
              const effectiveDocumentDiscount =
                liveEdits?.documentDiscount ??
                rowDocumentDiscounts[row.id] ??
                document?.documentDiscount ??
                0
              const rowSummary =
                showSummaryColumns && document
                  ? calculatePurchaseInvoiceRowSummary(
                      document,
                      effectiveRetentions,
                      effectivePurchaseInvoiceItems,
                      effectiveDocumentDiscount,
                    )
                  : null
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
                      onClick={(event) => {
                        event.preventDefault()
                        handleRowCheckboxClick(row.id, event)
                      }}
                      onChange={() => {}}
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
                  {!showSummaryColumns && (
                    <td className="support-table__cell-config">
                      {formatSupportDocumentTableAccount(rowAccounts[row.id])}
                    </td>
                  )}
                  {!showSummaryColumns && (
                    <td className="support-table__cell-config">
                      {formatSupportDocumentTablePaymentMethod(
                        rowPaymentMethods[row.id],
                      )}
                    </td>
                  )}
                  {showSummaryColumns && (
                    <td className="support-table__cell-config">
                      {rowSummary ? formatCurrency(rowSummary.subtotal) : '—'}
                    </td>
                  )}
                  {showIvaColumn && (
                    <td className="support-table__cell-config">
                      {showSummaryColumns
                        ? rowSummary
                          ? formatCurrency(rowSummary.ivaAmount)
                          : '—'
                        : formatSupportDocumentTableIva(rowIva[row.id])}
                    </td>
                  )}
                  <td className="support-table__cell-config">
                    {showSummaryColumns ? (
                      rowSummary && rowSummary.retentionLines.length > 0 ? (
                        <ul className="support-table__retention-breakdown">
                          {rowSummary.retentionLines.map((line) => (
                            <li key={line.label}>
                              {line.label}: {formatCurrency(line.amount)}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        '—'
                      )
                    ) : (
                      formatSupportDocumentTableRetentions(rowRetentions[row.id])
                    )}
                  </td>
                  {showSummaryColumns && (
                    <td className="support-table__cell-config">
                      {rowSummary ? formatCurrency(rowSummary.total) : '—'}
                    </td>
                  )}
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
                    <td colSpan={columnCount}>
                      <DocumentRowDetailPanel
                        document={document}
                        observations={rowObservations[row.id]}
                        editable={
                          showSummaryColumns
                            ? {
                                items:
                                  effectivePurchaseInvoiceItems ??
                                  buildPurchaseInvoiceItemDrafts(document),
                                paymentMethod: rowPaymentMethods[row.id] ?? null,
                                paymentMethodOptions,
                                accountOptions,
                                dueDate: rowDueDates[row.id] ?? null,
                                issueDate: rowDates[row.id] ?? '',
                                ivaOptions,
                                retentions: rowRetentions[row.id] ?? [],
                                retentionCatalogTypes,
                                retentionOptionsByType,
                                documentDiscount:
                                  rowDocumentDiscounts[row.id] ??
                                  document.documentDiscount ??
                                  0,
                                disabled: isSending || isDeleting,
                                onSave: (edits) => {
                                  onSaveRowEdits?.(row.id, edits)
                                  toggleRowExpanded(row.id)
                                },
                                onCancel: () => toggleRowExpanded(row.id),
                                onChange: (edits) =>
                                  setLiveRowEdits((current) => ({
                                    ...current,
                                    [row.id]: edits,
                                  })),
                              }
                            : undefined
                        }
                      />
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
