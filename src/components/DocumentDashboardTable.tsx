import type { ElectronicDocumentListItem } from '../types/electronicDocument'
import {
  getDocumentDashboardAction,
  getDocumentStatusClass,
  getDocumentStatusLabel,
} from '../utils/documentStatus'
import {
  getDocumentDisplayDate,
  getDocumentSupplierName,
} from '../utils/electronicDocumentDisplay'
import { formatCurrency, formatDate } from '../utils/formatters'

interface DocumentDashboardTableProps {
  documents: ElectronicDocumentListItem[]
  isLoading: boolean
  isResuming: boolean
  onContinueSupplier: (document: ElectronicDocumentListItem) => void
  onContinueAccount: (document: ElectronicDocumentListItem) => void
  onRetry: (document: ElectronicDocumentListItem) => void
}

function DocumentDashboardTable({
  documents,
  isLoading,
  isResuming,
  onContinueSupplier,
  onContinueAccount,
  onRetry,
}: DocumentDashboardTableProps) {
  if (isLoading) {
    return (
      <div className="document-dashboard__loading">
        <span className="loading-indicator__spinner" aria-hidden="true" />
        <p>Cargando documentos...</p>
      </div>
    )
  }

  if (documents.length === 0) {
    return (
      <p className="results-empty">
        No se encontraron documentos con los filtros seleccionados.
      </p>
    )
  }

  return (
    <div className="results-table-scroll document-dashboard-table">
      <table className="results-table">
        <thead>
          <tr>
            <th>Fecha del documento</th>
            <th>Número de factura</th>
            <th>Proveedor</th>
            <th>NIT proveedor</th>
            <th>Valor total</th>
            <th>Estado</th>
            <th>Última actualización</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((document) => {
            const action = getDocumentDashboardAction(document.status)

            return (
              <tr key={document.id}>
                <td>{getDocumentDisplayDate(document)}</td>
                <td>{document.invoiceNumber || '—'}</td>
                <td>{getDocumentSupplierName(document)}</td>
                <td>{document.supplierNit || '—'}</td>
                <td className="results-table__amount">
                  {formatCurrency(document.total)}
                </td>
                <td>
                  <span
                    className={`status-badge ${getDocumentStatusClass(document.status)}`}
                  >
                    {getDocumentStatusLabel(document.status)}
                  </span>
                </td>
                <td>{formatDate(document.updatedAt)}</td>
                <td className="document-dashboard-table__actions">
                  {action === 'continue_supplier' && (
                    <button
                      type="button"
                      className="document-dashboard-table__action"
                      onClick={() => onContinueSupplier(document)}
                      disabled={isResuming}
                    >
                      Continuar
                    </button>
                  )}
                  {action === 'continue_account' && (
                    <button
                      type="button"
                      className="document-dashboard-table__action"
                      onClick={() => onContinueAccount(document)}
                      disabled={isResuming}
                    >
                      Continuar
                    </button>
                  )}
                  {action === 'retry' && (
                    <button
                      type="button"
                      className="document-dashboard-table__action document-dashboard-table__action--retry"
                      onClick={() => onRetry(document)}
                      disabled={isResuming}
                    >
                      Reintentar
                    </button>
                  )}
                  {action === 'none' && (
                    <span className="document-dashboard-table__completed">
                      Proceso completado
                    </span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default DocumentDashboardTable
