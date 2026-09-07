import AccountAutocomplete from '../AccountAutocomplete'
import Button from '../Button'
import ProductAutocomplete from '../ProductAutocomplete'
import TaxAutocomplete from '../TaxAutocomplete'
import type { SiigoAccountOption } from '../../constants/siigoAccountCatalog'
import type { SiigoProductOption } from '../../constants/siigoProductCatalog'
import { formatTaxOptionLabelWithoutPrefix } from '../../constants/siigoTaxCatalog'
import type { SiigoTaxOption } from '../../constants/siigoTaxCatalog'
import type {
  PurchaseInvoiceItemDraft,
  PurchaseInvoiceItemType,
} from '../../types/purchaseInvoiceItemDraft'
import {
  calculatePurchaseInvoiceItemLineTotals,
  createEmptyPurchaseInvoiceItemDraft,
} from '../../types/purchaseInvoiceItemDraft'
import { formatCurrency } from '../../utils/formatters'

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

/** items[].type de SIIGO — campo obligatorio, solo admite estos 3 valores. */
const ITEM_TYPE_OPTIONS: Array<{ value: PurchaseInvoiceItemType; label: string }> = [
  { value: 'Account', label: 'Cuenta' },
  { value: 'Product', label: 'Producto' },
  { value: 'FixedAsset', label: 'Activo' },
]

interface PurchaseInvoiceItemsEditorProps {
  items: PurchaseInvoiceItemDraft[]
  onChange: (items: PurchaseInvoiceItemDraft[]) => void
  ivaOptions: SiigoTaxOption[]
  /** Retefuente se elige por ítem — columna "Imp. Ret." */
  retefuenteOptions: SiigoTaxOption[]
  /** Catálogo de cuentas contables — se usa para buscar código y nombre en
   * la columna "Producto" cuando el ítem es de tipo "Cuenta". */
  accountOptions: SiigoAccountOption[]
  /** Catálogo de productos SIIGO (GET /v1/products) — se usa para buscar
   * código y nombre en la columna "Producto" cuando el ítem es de tipo
   * "Producto". Activo fijo sigue siendo texto libre (SIIGO no expone un
   * catálogo de activos fijos por esta vía). */
  productOptions: SiigoProductOption[]
  /** payload.totals.total del documento (payable_amount certificado por la
   * DIAN) — la columna "Valor total" reparte este monto entre las líneas en
   * vez de sumar cantidad × valor unitario + IVA por línea. */
  documentTotal: number
  /** Prefijo + consecutivo de la factura del PROVEEDOR (ej. "FC-0418") — no
   * el consecutivo interno de SIIGO (ver siigoDocumentNumber, que se
   * muestra aparte en el estado de la fila). Se deja sin mostrar si el
   * documento no trae uno. */
  documentReference?: string | null
  disabled?: boolean
}

function PurchaseInvoiceItemsEditor({
  items,
  onChange,
  ivaOptions,
  retefuenteOptions,
  accountOptions,
  productOptions,
  documentTotal,
  documentReference = null,
  disabled = false,
}: PurchaseInvoiceItemsEditorProps) {
  // Con la factura ya en SIIGO ningún campo se puede editar, así que los
  // placeholders ("Buscar producto...", "Descripción") solo invitan a
  // escribir donde no se puede, y peor: se leen como si hubiera un dato. Un
  // campo sin valor se deja en blanco.
  const editablePlaceholder = (placeholder: string) =>
    disabled ? '' : placeholder

  const lineTotals = calculatePurchaseInvoiceItemLineTotals(items, documentTotal)
  const updateItem = (localId: string, patch: Partial<PurchaseInvoiceItemDraft>) => {
    onChange(
      items.map((item) => (item.localId === localId ? { ...item, ...patch } : item)),
    )
  }

  const removeItem = (localId: string) => {
    if (items.length <= 1) {
      return
    }

    onChange(items.filter((item) => item.localId !== localId))
  }

  return (
    <div className="purchase-item-editor">
      <div className="purchase-item-editor__header">
        <div className="purchase-item-editor__heading">
          <h3 className="support-table__detail-title">Ítems de la factura</h3>
          {documentReference && (
            <span className="purchase-item-editor__reference">
              {documentReference}
            </span>
          )}
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => onChange([...items, createEmptyPurchaseInvoiceItemDraft()])}
          disabled={disabled}
        >
          + Agregar ítem
        </Button>
      </div>

      <div className="purchase-item-editor__table-wrap">
        <table className="purchase-item-editor__table">
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Producto</th>
              <th>Descripción</th>
              <th>Cant.</th>
              <th>V/U</th>
              <th>Descuento</th>
              <th>IVA</th>
              <th>Imp. Ret.</th>
              <th>Valor total</th>
              <th aria-hidden="true" />
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => {
              const lineTotal = lineTotals[index] ?? 0

              return (
                <tr key={item.localId}>
                  <td className="purchase-item-editor__cell--tipo">
                    <select
                      className="purchase-item-editor__select purchase-item-editor__select--tipo"
                      value={item.tipo}
                      onChange={(event) =>
                        updateItem(item.localId, {
                          tipo: event.target.value as PurchaseInvoiceItemType,
                        })
                      }
                      disabled={disabled}
                    >
                      {ITEM_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="purchase-item-editor__account-cell">
                    {item.tipo === 'Account' ? (
                      <AccountAutocomplete
                        value={
                          accountOptions.find(
                            (account) => account.code === item.producto,
                          ) ??
                          (item.producto
                            ? { code: item.producto, description: item.producto }
                            : null)
                        }
                        onChange={(account) =>
                          updateItem(item.localId, { producto: account?.code ?? '' })
                        }
                        options={accountOptions}
                        disabled={disabled}
                        placeholder={editablePlaceholder('Buscar cuenta contable...')}
                      />
                    ) : item.tipo === 'Product' ? (
                      <ProductAutocomplete
                        value={
                          productOptions.find(
                            (product) => product.code === item.producto,
                          ) ??
                          (item.producto
                            ? { code: item.producto, description: item.producto }
                            : null)
                        }
                        onChange={(product) =>
                          updateItem(item.localId, { producto: product?.code ?? '' })
                        }
                        options={productOptions}
                        disabled={disabled}
                        placeholder={editablePlaceholder('Buscar producto...')}
                      />
                    ) : (
                      <input
                        type="text"
                        className="purchase-item-editor__input"
                        value={item.producto}
                        onChange={(event) =>
                          updateItem(item.localId, { producto: event.target.value })
                        }
                        disabled={disabled}
                        placeholder={editablePlaceholder('Código SIIGO')}
                      />
                    )}
                  </td>
                  <td className="purchase-item-editor__cell--description">
                    <input
                      type="text"
                      className="purchase-item-editor__input purchase-item-editor__input--wide"
                      value={item.description}
                      onChange={(event) =>
                        updateItem(item.localId, { description: event.target.value })
                      }
                      disabled={disabled}
                      placeholder={editablePlaceholder('Descripción')}
                    />
                  </td>
                  <td className="purchase-item-editor__cell--qty">
                    <input
                      type="number"
                      min={0}
                      className="purchase-item-editor__input purchase-item-editor__input--qty"
                      value={formatNumberInputValue(item.quantity)}
                      onChange={(event) =>
                        updateItem(item.localId, {
                          quantity: parseNumberInputValue(event.target.value),
                        })
                      }
                      onFocus={selectAllOnFocus}
                      disabled={disabled}
                    />
                  </td>
                  <td className="purchase-item-editor__cell--unit-value">
                    <input
                      type="number"
                      min={0}
                      className="purchase-item-editor__input purchase-item-editor__input--unit-value"
                      value={formatNumberInputValue(item.unitValue)}
                      onChange={(event) =>
                        updateItem(item.localId, {
                          unitValue: parseNumberInputValue(event.target.value),
                        })
                      }
                      onFocus={selectAllOnFocus}
                      disabled={disabled}
                    />
                  </td>
                  <td className="purchase-item-editor__cell--discount">
                    <input
                      type="number"
                      min={0}
                      className="purchase-item-editor__input purchase-item-editor__input--discount"
                      value={formatNumberInputValue(item.discount)}
                      onChange={(event) =>
                        updateItem(item.localId, {
                          discount: parseNumberInputValue(event.target.value),
                        })
                      }
                      onFocus={selectAllOnFocus}
                      disabled={disabled}
                    />
                  </td>
                  <td className="purchase-item-editor__tax-cell">
                    <TaxAutocomplete
                      value={item.ivaTax}
                      onChange={(tax) => updateItem(item.localId, { ivaTax: tax })}
                      options={ivaOptions}
                      disabled={disabled}
                      // Sin placeholder a propósito: el encabezado de la
                      // columna ya dice "IVA", y sin impuesto la celda se ve
                      // vacía igual que la de Descuento en vez de aparentar
                      // que trae un dato.
                      placeholder=""
                      formatOptionLabel={(tax) =>
                        formatTaxOptionLabelWithoutPrefix('IVA', tax)
                      }
                    />
                  </td>
                  <td className="purchase-item-editor__tax-cell">
                    <TaxAutocomplete
                      value={item.retefuenteTax}
                      onChange={(tax) => updateItem(item.localId, { retefuenteTax: tax })}
                      options={retefuenteOptions}
                      disabled={disabled}
                      placeholder=""
                      formatOptionLabel={(tax) =>
                        formatTaxOptionLabelWithoutPrefix('Retefuente', tax)
                      }
                    />
                  </td>
                  <td className="purchase-item-editor__readonly-cell purchase-item-editor__readonly-cell--total">
                    {formatCurrency(lineTotal)}
                  </td>
                  <td className="purchase-item-editor__cell--remove">
                    <button
                      type="button"
                      className="purchase-item-editor__remove"
                      onClick={() => removeItem(item.localId)}
                      disabled={disabled || items.length <= 1}
                      aria-label="Quitar ítem"
                      title="Quitar ítem"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default PurchaseInvoiceItemsEditor
