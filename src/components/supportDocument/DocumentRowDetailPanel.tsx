import type { SiigoAccountOption } from '../../constants/siigoAccountCatalog'
import type { SiigoCostCenterOption } from '../../constants/siigoCostCenterCatalog'
import type { SiigoPaymentMethodOption } from '../../constants/siigoPaymentMethodCatalog'
import CostCenterAutocomplete from '../CostCenterAutocomplete'
import type { SiigoProductOption } from '../../constants/siigoProductCatalog'
import type { SiigoTaxOption } from '../../constants/siigoTaxCatalog'
import type { ElectronicDocumentListItem } from '../../types/electronicDocument'
import { ELECTRONIC_DOCUMENT_TYPE } from '../../types/electronicDocument'
import type { PurchaseInvoiceItemDraft } from '../../types/purchaseInvoiceItemDraft'
import { formatCurrency } from '../../utils/formatters'
import PurchaseInvoiceDetailEditor, {
  type PurchaseInvoiceDetailEditorSave,
} from './PurchaseInvoiceDetailEditor'

export interface DocumentRowDetailEditableProps {
  items: PurchaseInvoiceItemDraft[]
  paymentMethod: SiigoPaymentMethodOption | null
  paymentMethodOptions: SiigoPaymentMethodOption[]
  accountOptions: SiigoAccountOption[]
  productOptions: SiigoProductOption[]
  dueDate: string | null
  issueDate: string
  ivaOptions: SiigoTaxOption[]
  retentions: SiigoTaxOption[]
  retentionCatalogTypes: readonly string[]
  retentionOptionsByType: Record<string, SiigoTaxOption[]>
  documentDiscount: number
  disabled?: boolean
  onSaveDraft?: () => void | Promise<void>
  isSavingDraft?: boolean
  onChange?: (edits: PurchaseInvoiceDetailEditorSave) => void
}

interface DocumentRowDetailPanelProps {
  document: ElectronicDocumentListItem
  observations?: string
  /** Solo Factura de compra: convierte el panel en un editor completo
   * (ítems, forma de pago, plazo, retenciones/IVA, observaciones). */
  editable?: DocumentRowDetailEditableProps
  /** Documento soporte (no editable): centro de costos editable desde este
   * mismo detalle desplegado, sin necesidad de seleccionar la fila primero
   * (a diferencia del centro de costos de la barra de selección masiva). */
  costCenterOptions?: SiigoCostCenterOption[]
  costCenter?: SiigoCostCenterOption | null
  onCostCenterChange?: (costCenter: SiigoCostCenterOption) => void
  costCenterDisabled?: boolean
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
  editable,
  costCenterOptions,
  costCenter,
  onCostCenterChange,
  costCenterDisabled = false,
}: DocumentRowDetailPanelProps) {
  const cufe = document.cufe?.trim()
  const dianNotes = document.observations?.trim() || ''
  // Factura de compra: si el usuario todavía no guardó observaciones para
  // este documento, se sugiere "CUFE: ... - <notas de la factura>" en vez de
  // dejarlo vacío — así el CUFE y las notas de la DIAN quedan a la vista.
  const defaultPurchaseObservations = cufe
    ? `CUFE: ${cufe}${dianNotes ? ` - ${dianNotes}` : ''}`
    : dianNotes
  const resolvedObservations = editable
    ? observations?.trim() || defaultPurchaseObservations
    : observations?.trim() || dianNotes

  if (editable) {
    return (
      <div className="support-table__detail-panel">
        <PurchaseInvoiceDetailEditor
          document={document}
          items={editable.items}
          paymentMethod={editable.paymentMethod}
          paymentMethodOptions={editable.paymentMethodOptions}
          accountOptions={editable.accountOptions}
          productOptions={editable.productOptions}
          dueDate={editable.dueDate}
          issueDate={editable.issueDate}
          observations={resolvedObservations}
          ivaOptions={editable.ivaOptions}
          retentions={editable.retentions}
          retentionCatalogTypes={editable.retentionCatalogTypes}
          retentionOptionsByType={editable.retentionOptionsByType}
          documentDiscount={editable.documentDiscount}
          disabled={editable.disabled}
          onSaveDraft={editable.onSaveDraft}
          isSavingDraft={editable.isSavingDraft}
          onChange={editable.onChange}
        />
      </div>
    )
  }

  const items = document.items ?? []

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

        {onCostCenterChange && (
          <div className="support-table__detail-field">
            <span className="support-table__detail-label">
              Centro de costos
            </span>
            <CostCenterAutocomplete
              value={costCenter ?? null}
              onChange={onCostCenterChange}
              options={costCenterOptions}
              disabled={costCenterDisabled}
              placeholder="Ninguno"
            />
          </div>
        )}

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
