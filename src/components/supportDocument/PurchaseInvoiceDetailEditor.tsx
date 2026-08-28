import { useEffect, useRef, useState } from 'react'
import Button from '../Button'
import DatePicker from '../DatePicker'
import PaymentMethodAutocomplete from '../PaymentMethodAutocomplete'
import TaxAutocomplete from '../TaxAutocomplete'
import PurchaseInvoiceItemsEditor from './PurchaseInvoiceItemsEditor'
import type { SiigoAccountOption } from '../../constants/siigoAccountCatalog'
import type { SiigoPaymentMethodOption } from '../../constants/siigoPaymentMethodCatalog'
import type { SiigoTaxOption } from '../../constants/siigoTaxCatalog'
import {
  formatRetentionTypeDisplayLabel,
  mergeRetentionsByTypes,
  splitRetentionsByTypes,
} from '../../constants/siigoTaxCatalog'
import type { ElectronicDocumentListItem } from '../../types/electronicDocument'
import type { PurchaseInvoiceItemDraft } from '../../types/purchaseInvoiceItemDraft'
import { isCreditPaymentMethod } from '../../utils/siigoPaymentMethods'
import { addDaysToLocalDate, resolvePlazoDays } from '../../utils/supportDocumentDate'
import { formatCurrency } from '../../utils/formatters'
import { calculatePurchaseInvoiceRowSummary } from '../../utils/purchaseInvoiceRowSummary'

/** Retefuente se elige por ítem (columna "Imp. Ret." de la tabla de ítems),
 * no en este panel de resumen. */
const RETEFUENTE_TAX_TYPE = 'Retefuente'

/** SIIGO rechaza /v1/purchases y /v1/support-documents-inbound con
 * `length_max` si observations supera los 1000 caracteres (ver
 * truncateSiigoObservations en el backend) — se limita acá también para que
 * el usuario vea el tope mientras escribe, en vez de enterarse recién al
 * enviar (o de que el texto se trunque en silencio del lado del servidor). */
const OBSERVATIONS_MAX_LENGTH = 1000

/** Valor a mostrar en un input numérico controlado: vacío en vez de "0" —
 * así el usuario puede escribir directo (o borrar hasta dejarlo en blanco)
 * sin pelear con un cero que no se deja reemplazar ni eliminar. */
function formatNumberInputValue(value: number): number | string {
  return value === 0 ? '' : value
}

function parseNumberInputValue(rawValue: string): number {
  return rawValue === '' ? 0 : Math.max(0, Number(rawValue) || 0)
}

/** Selecciona todo el texto al enfocar — así escribir reemplaza el valor
 * completo en vez de insertarse a la mitad/después de lo que ya había. */
function selectAllOnFocus(event: React.FocusEvent<HTMLInputElement>) {
  event.target.select()
}

export interface PurchaseInvoiceDetailEditorSave {
  items: PurchaseInvoiceItemDraft[]
  paymentMethod: SiigoPaymentMethodOption | null
  dueDate: string | null
  observations: string
  retentions: SiigoTaxOption[]
  documentDiscount: number
}

interface PurchaseInvoiceDetailEditorProps {
  document: ElectronicDocumentListItem
  items: PurchaseInvoiceItemDraft[]
  paymentMethod: SiigoPaymentMethodOption | null
  paymentMethodOptions: SiigoPaymentMethodOption[]
  accountOptions: SiigoAccountOption[]
  dueDate: string | null
  issueDate: string
  observations: string
  ivaOptions: SiigoTaxOption[]
  retentions: SiigoTaxOption[]
  retentionCatalogTypes: readonly string[]
  retentionOptionsByType: Record<string, SiigoTaxOption[]>
  /** Descuento general editado — arranca en `document.documentDiscount` (el
   * certificado por la DIAN) mientras el contador no lo haya tocado. */
  documentDiscount: number
  disabled?: boolean
  onSave: (edits: PurchaseInvoiceDetailEditorSave) => void
  onCancel: () => void
  /** Se dispara con cada cambio en el borrador (ítems, retenciones, medio de
   * pago, etc.) — no solo al guardar. Así el Total que se ve en la fila
   * colapsada del listado (arriba) se mantiene siempre igual al "Total neto"
   * de este panel mientras el usuario edita, en vez de quedarse con el
   * último valor guardado hasta que hace clic en "Guardar cambios". */
  onChange?: (edits: PurchaseInvoiceDetailEditorSave) => void
}

function PurchaseInvoiceDetailEditor({
  document,
  items,
  paymentMethod,
  paymentMethodOptions,
  accountOptions,
  dueDate,
  issueDate,
  observations,
  ivaOptions,
  retentions,
  retentionCatalogTypes,
  retentionOptionsByType,
  documentDiscount,
  disabled = false,
  onSave,
  onCancel,
  onChange,
}: PurchaseInvoiceDetailEditorProps) {
  const sidebarRetentionTypes = retentionCatalogTypes.filter(
    (taxType) => taxType !== RETEFUENTE_TAX_TYPE,
  )

  const [draftItems, setDraftItems] = useState(items)
  const [draftPaymentMethod, setDraftPaymentMethod] = useState(paymentMethod)
  const [draftDueDate, setDraftDueDate] = useState(dueDate)
  const [draftObservations, setDraftObservations] = useState(observations)
  const [draftRetentionsByType, setDraftRetentionsByType] = useState(() =>
    splitRetentionsByTypes(retentions, sidebarRetentionTypes),
  )
  const [draftDocumentDiscount, setDraftDocumentDiscount] =
    useState(documentDiscount)

  const isCreditSelected = isCreditPaymentMethod(draftPaymentMethod)
  // El medio de pago arranca en blanco (ya no se autosugiere), pero la
  // factura puede traer plazo/fecha de vencimiento igual — no hay que
  // esperar a que se elija un medio de pago de crédito para mostrarlos.
  const showDueDateFields = isCreditSelected || Boolean(draftDueDate)
  // Plazo es un dato FIJO del documento (los días de crédito que otorgó el
  // vendedor al emitir la factura) — nunca se deriva de la fecha actual del
  // sistema. Mientras el vencimiento no se haya tocado se confía primero en
  // duration_measure (el dato explícito del emisor, más confiable); en
  // cuanto el usuario edita el vencimiento (a mano o escribiendo el Plazo)
  // se recalcula siempre desde issueDate/draftDueDate.
  const dueDateWasEdited = draftDueDate !== dueDate
  const plazoDays = resolvePlazoDays(
    issueDate || null,
    draftDueDate,
    dueDateWasEdited ? null : (document.paymentDurationMeasure ?? null),
  )

  const handlePlazoChange = (days: number | null) => {
    if (days === null) {
      setDraftDueDate(null)
      return
    }

    if (!issueDate) {
      // Sin fecha de emisión fija no hay una referencia segura para anclar
      // el nuevo vencimiento — nunca se usa la fecha actual como respaldo.
      return
    }

    setDraftDueDate(addDaysToLocalDate(issueDate, days))
  }

  const draftRetentions = mergeRetentionsByTypes(
    draftRetentionsByType,
    sidebarRetentionTypes,
  )
  const summary = calculatePurchaseInvoiceRowSummary(
    document,
    draftRetentions,
    draftItems,
    draftDocumentDiscount,
  )

  // Ref en vez de dependencia directa: `onChange` es una closure nueva en
  // cada render del padre (no viene memoizada con useCallback), así que
  // listarla en el arreglo de dependencias dispararía el efecto de nuevo en
  // cada re-render causado por el propio onChange — un loop infinito.
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    onChangeRef.current?.({
      items: draftItems,
      paymentMethod: draftPaymentMethod,
      dueDate: draftDueDate,
      observations: draftObservations,
      retentions: draftRetentions,
      documentDiscount: draftDocumentDiscount,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    draftItems,
    draftPaymentMethod,
    draftDueDate,
    draftObservations,
    draftRetentionsByType,
    draftDocumentDiscount,
  ])

  const handleSave = () => {
    onSave({
      items: draftItems,
      paymentMethod: draftPaymentMethod,
      dueDate: draftDueDate,
      observations: draftObservations,
      retentions: draftRetentions,
      documentDiscount: draftDocumentDiscount,
    })
  }

  return (
    <div className="purchase-invoice-editor">
      <PurchaseInvoiceItemsEditor
        items={draftItems}
        onChange={setDraftItems}
        ivaOptions={ivaOptions}
        retefuenteOptions={retentionOptionsByType[RETEFUENTE_TAX_TYPE] ?? []}
        accountOptions={accountOptions}
        documentTotal={document.total}
        disabled={disabled}
      />

      <div className="purchase-invoice-editor__lower">
        <div className="purchase-invoice-editor__fields">
          <div className="purchase-invoice-editor__field-row">
            <div className="purchase-invoice-editor__field">
              <label htmlFor={`purchase-payment-${document.id}`}>Forma de pago</label>
              <PaymentMethodAutocomplete
                id={`purchase-payment-${document.id}`}
                value={draftPaymentMethod}
                onChange={setDraftPaymentMethod}
                options={paymentMethodOptions}
                disabled={disabled}
                placeholder="Buscar medio de pago..."
              />
            </div>

            <div className="purchase-invoice-editor__field purchase-invoice-editor__field--plazo">
              <label htmlFor={`purchase-plazo-${document.id}`}>Plazo</label>
              <div className="purchase-invoice-editor__plazo">
                <input
                  id={`purchase-plazo-${document.id}`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={plazoDays ?? ''}
                  onChange={(event) => {
                    const raw = event.target.value
                    handlePlazoChange(raw === '' ? null : Math.max(0, Number(raw)))
                  }}
                  disabled={disabled || !showDueDateFields}
                  placeholder="0"
                />
                <span className="purchase-invoice-editor__plazo-suffix">días</span>
              </div>
            </div>
          </div>

          {showDueDateFields && (
            <div className="purchase-invoice-editor__field">
              <label htmlFor={`purchase-due-date-${document.id}`}>
                Fecha de vencimiento
              </label>
              <DatePicker
                id={`purchase-due-date-${document.id}`}
                value={draftDueDate ?? ''}
                onChange={(value) => setDraftDueDate(value || null)}
                disabled={disabled}
              />
            </div>
          )}

          <div className="purchase-invoice-editor__field">
            <label htmlFor={`purchase-observations-${document.id}`}>
              Observaciones
            </label>
            <textarea
              id={`purchase-observations-${document.id}`}
              className="purchase-invoice-editor__textarea"
              value={draftObservations}
              onChange={(event) =>
                setDraftObservations(
                  event.target.value.slice(0, OBSERVATIONS_MAX_LENGTH),
                )
              }
              disabled={disabled}
              rows={4}
              maxLength={OBSERVATIONS_MAX_LENGTH}
            />
            <span className="purchase-invoice-editor__char-count">
              {draftObservations.length} / {OBSERVATIONS_MAX_LENGTH}
            </span>
          </div>
        </div>

        <div className="purchase-invoice-editor__summary">
          <div className="purchase-invoice-editor__summary-row">
            <span>Subtotal</span>
            <span>{formatCurrency(summary.subtotal)}</span>
          </div>

          <div className="purchase-invoice-editor__summary-row">
            <span>Descuento general</span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              className="purchase-invoice-editor__discount-input"
              value={formatNumberInputValue(draftDocumentDiscount)}
              onChange={(event) =>
                setDraftDocumentDiscount(parseNumberInputValue(event.target.value))
              }
              onFocus={selectAllOnFocus}
              disabled={disabled}
              placeholder="0"
            />
          </div>

          <div className="purchase-invoice-editor__summary-row">
            <span>IVA</span>
            <span>{formatCurrency(summary.ivaAmount)}</span>
          </div>

          {sidebarRetentionTypes.map((taxType) => {
            const line = summary.retentionLines.find((entry) => entry.type === taxType)

            return (
              <div
                key={taxType}
                className="purchase-invoice-editor__summary-row purchase-invoice-editor__summary-row--select"
              >
                <span>{formatRetentionTypeDisplayLabel(taxType)}</span>
                <TaxAutocomplete
                  value={draftRetentionsByType[taxType] ?? null}
                  onChange={(tax) =>
                    setDraftRetentionsByType((current) => ({
                      ...current,
                      [taxType]: tax,
                    }))
                  }
                  options={retentionOptionsByType[taxType] ?? []}
                  disabled={disabled}
                  placeholder={`Buscar ${formatRetentionTypeDisplayLabel(taxType)}...`}
                />
                <span
                  className={
                    line && line.amount > 0
                      ? 'purchase-invoice-editor__amount purchase-invoice-editor__amount--negative'
                      : 'purchase-invoice-editor__amount'
                  }
                >
                  {line && line.amount > 0
                    ? `-${formatCurrency(line.amount)}`
                    : formatCurrency(0)}
                </span>
              </div>
            )
          })}

          <div className="purchase-invoice-editor__summary-row purchase-invoice-editor__summary-row--total">
            <span>Total neto</span>
            <span>{formatCurrency(summary.total)}</span>
          </div>
        </div>
      </div>

      <div className="purchase-invoice-editor__actions">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={disabled}>
          Cancelar
        </Button>
        <Button type="button" variant="primary" onClick={handleSave} disabled={disabled}>
          Guardar cambios
        </Button>
      </div>
    </div>
  )
}

export default PurchaseInvoiceDetailEditor
