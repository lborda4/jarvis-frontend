import { useEffect, useRef, useState } from 'react'
import CostCenterAutocomplete from '../CostCenterAutocomplete'
import type { SiigoCostCenterOption } from '../../constants/siigoCostCenterCatalog'
import Button from '../Button'
import DatePicker from '../DatePicker'
import PaymentMethodAutocomplete from '../PaymentMethodAutocomplete'
import TaxAutocomplete from '../TaxAutocomplete'
import PurchaseInvoiceItemsEditor from './PurchaseInvoiceItemsEditor'
import type { SiigoAccountOption } from '../../constants/siigoAccountCatalog'
import type { SiigoPaymentMethodOption } from '../../constants/siigoPaymentMethodCatalog'
import type { SiigoProductOption } from '../../constants/siigoProductCatalog'
import type { SiigoTaxOption } from '../../constants/siigoTaxCatalog'
import {
  formatRetentionTypeDisplayLabel,
  mergeRetentionsByTypes,
  splitRetentionsByTypes,
} from '../../constants/siigoTaxCatalog'
import type { ElectronicDocumentListItem } from '../../types/electronicDocument'
import type { PurchaseInvoiceItemDraft } from '../../types/purchaseInvoiceItemDraft'
import type { SiigoSendFieldErrors } from '../../utils/supportDocumentSend'
import { isCreditPaymentMethod } from '../../utils/siigoPaymentMethods'
import { addDaysToLocalDate, resolvePlazoDays } from '../../utils/supportDocumentDate'
import { formatInvoiceCurrency as formatCurrency } from '../../utils/formatters'
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

export interface PurchaseInvoiceDetailEditorSave {
  costCenter?: SiigoCostCenterOption | null
  items: PurchaseInvoiceItemDraft[]
  paymentMethod: SiigoPaymentMethodOption | null
  dueDate: string | null
  observations: string
  retentions: SiigoTaxOption[]
  documentDiscount: number
}

interface PurchaseInvoiceDetailEditorProps {
  costCenter?: SiigoCostCenterOption | null
  costCenterOptions?: SiigoCostCenterOption[]
  onCostCenterChange?: (value: SiigoCostCenterOption) => void
  document: ElectronicDocumentListItem
  items: PurchaseInvoiceItemDraft[]
  paymentMethod: SiigoPaymentMethodOption | null
  paymentMethodOptions: SiigoPaymentMethodOption[]
  accountOptions: SiigoAccountOption[]
  productOptions: SiigoProductOption[]
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
  /** Persiste el borrador. Recibe los valores actuales del editor — no los
   * del padre — para no guardar la sugerencia original si el setState del
   * onChange todavía no había llegado. */
  onSaveDraft?: (edits: PurchaseInvoiceDetailEditorSave) => void | Promise<void>
  isSavingDraft?: boolean
  /** Se dispara con CADA cambio del borrador para mantener sincronizada la
   * fila del listado (el Total de la fila colapsada sigue al "Total neto" de
   * este panel). Persistir es otra cosa: eso lo hace onSaveDraft. */
  onChange?: (edits: PurchaseInvoiceDetailEditorSave) => void
  fieldErrors?: SiigoSendFieldErrors | null
}

function PurchaseInvoiceDetailEditor({
  costCenter = null,
  costCenterOptions = [],
  onCostCenterChange,
  document,
  items,
  paymentMethod,
  paymentMethodOptions,
  accountOptions,
  productOptions,
  dueDate,
  issueDate,
  observations,
  ivaOptions,
  retentions,
  retentionCatalogTypes,
  retentionOptionsByType,
  disabled = false,
  onSaveDraft,
  isSavingDraft = false,
  onChange,
  fieldErrors = null,
}: PurchaseInvoiceDetailEditorProps) {
  const sidebarRetentionTypes = retentionCatalogTypes.filter(
    (taxType) => taxType !== RETEFUENTE_TAX_TYPE,
  )
  // Si la factura no trae su propio vencimiento (no vino en NextPyme/DIAN ni
  // se eligió a mano antes), arranca en la fecha de la factura — Plazo en 0,
  // "de contado" — en vez de vacío/oculto. El contador siempre ve una fecha
  // de vencimiento y un Plazo concretos, y los edita a mano si es a crédito.
  const initialDueDate = dueDate ?? (issueDate || null)

  // Con la factura ya en SIIGO ningún campo se puede editar: un "Buscar
  // medio de pago..." ahí solo invita a escribir donde no se puede, y de
  // lejos se lee como si el campo trajera un dato. Sin valor, en blanco.
  const editablePlaceholder = (placeholder: string) =>
    disabled ? '' : placeholder

  const [draftItems, setDraftItems] = useState(items)
  const userEditedItemsRef = useRef(false)
  const [draftPaymentMethod, setDraftPaymentMethod] = useState(paymentMethod)
  const [draftDueDate, setDraftDueDate] = useState(initialDueDate)
  const [draftObservations, setDraftObservations] = useState(observations)
  const [draftRetentionsByType, setDraftRetentionsByType] = useState(() =>
    splitRetentionsByTypes(retentions, sidebarRetentionTypes),
  )
  const draftDocumentDiscount = document.documentDiscount ?? 0

  const isCreditSelected = isCreditPaymentMethod(draftPaymentMethod)
  // El medio de pago arranca en blanco (ya no se autosugiere), pero con el
  // fallback de initialDueDate de arriba draftDueDate casi siempre tiene
  // valor — esta condición solo importa como respaldo en el caso borde de
  // issueDate vacío.
  const showDueDateFields = isCreditSelected || Boolean(draftDueDate)
  // Plazo es un dato FIJO del documento (los días de crédito que otorgó el
  // vendedor al emitir la factura) — nunca se deriva de la fecha actual del
  // sistema. Mientras el vencimiento no se haya tocado (comparado contra
  // initialDueDate, no contra el prop `dueDate` crudo — si no, el fallback de
  // arriba se contaría como "edición" desde el primer render) se confía
  // primero en duration_measure (el dato explícito del emisor, más
  // confiable); en cuanto el usuario edita el vencimiento (a mano o
  // escribiendo el Plazo) se recalcula siempre desde issueDate/draftDueDate.
  const dueDateWasEdited = draftDueDate !== initialDueDate
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
  // La Retefuente se elige por ítem, así que no tiene selector en este panel
  // (a diferencia de Rete ICA/Rete IVA) — pero su monto sí se resta del Total
  // neto, y sin una fila propia no había forma de ver de dónde salía esa
  // diferencia. Se muestra igual que el IVA: acumulado de todas las líneas.
  const retefuenteAmount =
    summary.retentionLines.find((line) => line.type === RETEFUENTE_TAX_TYPE)
      ?.amount ?? 0

  // Ref en vez de dependencia directa: `onChange` es una closure nueva en
  // cada render del padre (no viene memoizada con useCallback), así que
  // listarla en el arreglo de dependencias dispararía el efecto de nuevo en
  // cada re-render causado por el propio onChange — un loop infinito.
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    setDraftItems((current) => {
      if (current.length === 0 && items.length > 0) {
        return items
      }

      const incomingFilledEmptyLines = items.some(
        (item, index) =>
          Boolean(item.producto?.trim()) &&
          !current[index]?.codeManuallyEdited &&
          !current[index]?.producto?.trim(),
      )

      if (!incomingFilledEmptyLines) {
        return current
      }

      if (userEditedItemsRef.current) {
        return current.map((item, index) => {
          if (item.codeManuallyEdited || item.producto?.trim() || !items[index]?.producto?.trim()) {
            return item
          }

          return {
            ...item,
            tipo: items[index].tipo,
            producto: items[index].producto,
          }
        })
      }

      return items
    })
  }, [items])

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

  return (
    <div className="purchase-invoice-editor">
      {!disabled && (document.suggestedItemConfig?.retefuenteTax || document.suggestedRetentions?.length) ? (
        <p role="note">
          Retenciones sugeridas por el historial: {Array.from(new Set([
            document.suggestedItemConfig?.retefuenteTax?.name,
            ...(document.suggestedRetentions ?? []).map((tax) => tax.name),
          ].filter(Boolean))).join(', ')}.
          {' '}Revisa y selecciona las que correspondan en los campos de retenciones. No se aplican automáticamente.
        </p>
      ) : null}
      <PurchaseInvoiceItemsEditor
        items={draftItems}
        onChange={(next) => {
          userEditedItemsRef.current = true
          setDraftItems(next)
        }}
        ivaOptions={ivaOptions}
        retefuenteOptions={retentionOptionsByType[RETEFUENTE_TAX_TYPE] ?? []}
        accountOptions={accountOptions}
        productOptions={productOptions}
        documentTotal={document.total}
        documentReference={
          document.invoiceNumber?.trim() || document.cufe?.trim() || null
        }
        disabled={disabled}
        invalidItemCodes={fieldErrors ? new Set(fieldErrors.itemCodes) : undefined}
        invalidItemDescriptions={fieldErrors ? new Set(fieldErrors.itemDescriptions) : undefined}
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
                // Ver editablePlaceholder: con la factura ya en SIIGO no hay
                // nada que buscar, y el texto se lee como si fuera un dato.
                placeholder={editablePlaceholder('Buscar medio de pago...')}
                invalid={Boolean(fieldErrors?.paymentMethod)}
              />
              {fieldErrors?.paymentMethod && (
                <em className="support-field-error">{fieldErrors.paymentMethod}</em>
              )}
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

          {(showDueDateFields || onCostCenterChange || fieldErrors?.dueDate) && (
            <div className="purchase-invoice-editor__field-row purchase-invoice-editor__field-row--due-date">
              {(showDueDateFields || fieldErrors?.dueDate) && (
                <div className="purchase-invoice-editor__field">
                  <label htmlFor={`purchase-due-date-${document.id}`}>
                    Fecha de vencimiento
                  </label>
                  <DatePicker
                    id={`purchase-due-date-${document.id}`}
                    value={draftDueDate ?? ''}
                    onChange={(value) => setDraftDueDate(value || null)}
                    disabled={disabled}
                    invalid={Boolean(fieldErrors?.dueDate)}
                  />
                  {fieldErrors?.dueDate && (
                    <em className="support-field-error">{fieldErrors.dueDate}</em>
                  )}
                </div>
              )}
              {onCostCenterChange && (
                <div className="purchase-invoice-editor__field">
                  <label htmlFor={`purchase-cost-center-${document.id}`}>
                    Centro de costos (opcional)
                  </label>
                  <CostCenterAutocomplete
                    id={`purchase-cost-center-${document.id}`}
                    value={costCenter}
                    onChange={onCostCenterChange}
                    options={costCenterOptions}
                    disabled={disabled}
                    placeholder="Seleccionar centro de costos"
                  />
                </div>
              )}
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
            <span>{formatCurrency(summary.documentDiscount)}</span>
          </div>

          <div className="purchase-invoice-editor__summary-row">
            <span>IVA</span>
            <span>{formatCurrency(summary.ivaAmount)}</span>
          </div>

          {summary.consumptionTaxAmount > 0 && (
            <div className="purchase-invoice-editor__summary-row">
              <span>Impuesto al consumo</span>
              <span>{formatCurrency(summary.consumptionTaxAmount)}</span>
            </div>
          )}

          <div className="purchase-invoice-editor__summary-row">
            <span>{formatRetentionTypeDisplayLabel(RETEFUENTE_TAX_TYPE)}</span>
            <span
              className={
                retefuenteAmount > 0
                  ? 'purchase-invoice-editor__amount purchase-invoice-editor__amount--negative'
                  : 'purchase-invoice-editor__amount'
              }
            >
              {retefuenteAmount > 0
                ? `-${formatCurrency(retefuenteAmount)}`
                : formatCurrency(0)}
            </span>
          </div>

          {sidebarRetentionTypes.map((taxType) => {
            const line = summary.retentionLines.find((entry) => entry.type === taxType)
            const selectedTax = draftRetentionsByType[taxType] ?? null
            // Con la factura ya en SIIGO (o mientras se está enviando) el
            // buscador no hace nada, y si además no hay retención elegida
            // queda un campo muerto que invita a escribir. Se oculta solo el
            // buscador: la fila sigue mostrando la retención y su monto, para
            // que el resumen no cambie de forma según el estado.
            const showRetentionPicker = !disabled || Boolean(selectedTax)

            return (
              <div
                key={taxType}
                className="purchase-invoice-editor__summary-row purchase-invoice-editor__summary-row--select"
              >
                <span>{formatRetentionTypeDisplayLabel(taxType)}</span>
                {showRetentionPicker ? (
                  <TaxAutocomplete
                    value={selectedTax}
                    onChange={(tax) =>
                      setDraftRetentionsByType((current) => ({
                        ...current,
                        [taxType]: tax,
                      }))
                    }
                    options={retentionOptionsByType[taxType] ?? []}
                    disabled={disabled}
                    placeholder={editablePlaceholder(
                      `Buscar ${formatRetentionTypeDisplayLabel(taxType)}...`,
                    )}
                  />
                ) : (
                  // La celda del medio se mantiene (la fila es una grilla de
                  // 3 columnas) para que el monto siga alineado con el de las
                  // demás filas del resumen.
                  <span />
                )}
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

      {onSaveDraft && !disabled && (
        <div className="purchase-invoice-editor__actions">
          <Button
            type="button"
            variant="primary"
            onClick={() =>
              void onSaveDraft({
                costCenter,
                items: draftItems,
                paymentMethod: draftPaymentMethod,
                dueDate: draftDueDate,
                observations: draftObservations,
                retentions: draftRetentions,
                documentDiscount: draftDocumentDiscount,
              })
            }
            disabled={isSavingDraft}
          >
            {isSavingDraft ? 'Guardando...' : 'Guardar cambios'}
          </Button>
        </div>
      )}
    </div>
  )
}

export default PurchaseInvoiceDetailEditor
