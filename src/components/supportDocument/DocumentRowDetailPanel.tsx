import type { ElectronicDocumentListItem } from '../../types/electronicDocument'
import { ELECTRONIC_DOCUMENT_TYPE } from '../../types/electronicDocument'
import { formatCurrency } from '../../utils/formatters'

interface DocumentRowDetailPanelProps {
  document: ElectronicDocumentListItem
  observations?: string
}

function formatDocumentReference(document: ElectronicDocumentListItem): string {
  if (document.electronicDocumentType === ELECTRONIC_DOCUMENT_TYPE.PURCHASE_INVOICE) {
    return document.invoiceNumber?.trim() || document.cufe?.trim() || '—'
  }

  return document.invoiceNumber?.trim() || '—'
}

export default function DocumentRowDetailPanel({
  document,
  observations,
}: DocumentRowDetailPanelProps) {
  const items = document.items ?? []
  const resolvedObservations =
    observations?.trim() || document.observations?.trim() || ''

  return (
    <div className="support-table__detail-panel">
      <div className="support-table__detail-summary">
        <div className="support-table__detail-field">
          <span className="support-table__detail-label">Documento</span>
          <span>{formatDocumentReference(document)}</span>
        </div>

        {document.cufe?.trim() && (
          <div className="support-table__detail-field">
            <span className="support-table__detail-label">CUFE</span>
            <span className="support-table__detail-value--mono">
              {document.cufe}
            </span>
          </div>
        )}

        <div className="support-table__detail-field">
          <span className="support-table__detail-label">Total</span>
          <span>{formatCurrency(document.total)}</span>
        </div>

        {resolvedObservations && (
          <div className="support-table__detail-field support-table__detail-field--wide">
            <span className="support-table__detail-label">Observaciones</span>
            <span>{resolvedObservations}</span>
          </div>
        )}
      </div>

      <div className="support-table__detail-section">
        {items.length === 0 ? (
          <p className="support-table__detail-empty">
            Este documento no tiene ítems detallados.
          </p>
        ) : (
          <table className="support-table__detail-items">
            <thead>
              <tr>
                <th>Descripción</th>
                <th>Cantidad</th>
                <th>Valor unitario</th>
                <th>Total</th>
                <th>Impuesto</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={`${document.id}-item-${index}`}>
                  <td>{item.description}</td>
                  <td>{item.quantity}</td>
                  <td>{formatCurrency(item.unitValue)}</td>
                  <td>{formatCurrency(item.total)}</td>
                  <td>
                    {item.suggestedTax
                      ? `${item.suggestedTax.name} (${item.suggestedTax.percentage}%)`
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
