import { type FormEvent, useEffect, useMemo, useState } from 'react'
import Autocomplete from './Autocomplete'
import Button from './Button'
import CategorySelect from './CategorySelect'
import ConfirmDialog from './ConfirmDialog'
import ErrorMessage from './ErrorMessage'
import Modal from './Modal'
import {
  PRODUCT_DESCRIPTION_MAX_LENGTH,
  PRODUCT_KIND,
  PRODUCT_KIND_OPTIONS,
  formatMoneyInput,
  parseMoneyInput,
  type ProductCategory,
  type ProductKind,
} from '../constants/createProduct'
import { getApiErrorMessage } from '../services/apiClient'
import { fetchJarvisTaxes } from '../services/jarvisService'
import {
  createProduct,
  createProductCategory,
  fetchNextSku,
  fetchProductCategories,
  fetchUnitMeasures,
  updateProductCategory,
  type CreateProductRequest,
  type ProductResponse,
  type UnitMeasure,
} from '../services/productService'
import type { JarvisTax } from '../types/jarvis'
import '../pages/CreateProductPage.css'

/** Unidad de medida DIAN por defecto: "Unidad" (código 94). Se preselecciona
 * en el formulario y se muestra mientras carga el catálogo de NextPyme. */
const DEFAULT_UNIT_MEASURE: UnitMeasure = { code: '94', name: 'Unidad' }

function formatTaxRate(tax: JarvisTax): string {
  return tax.rate === null ? '—' : `${tax.rate} %`
}

/** Nombre por defecto para el precio en esa posición (1-indexado) — se usa
 * como placeholder mientras el campo está vacío, y como valor real si el
 * usuario nunca lo llena (el backend exige un nombre no vacío). */
function defaultPriceListName(position: number): string {
  return DEFAULT_PRICE_LIST_NAMES[position - 1] ?? `Precio ${position}`
}

export interface CreateProductModalProps {
  isOpen: boolean
  onClose: () => void
  onCreated: (product: ProductResponse) => void
}

const MAX_PRICE_LISTS = 3
const DEFAULT_PRICE_LIST_NAMES = ['Precio general', 'Precio 2', 'Precio 3']

interface PriceListDraft {
  id: number
  name: string
  price: string
}

interface ProductFormState {
  kind: ProductKind
  sku: string
  name: string
  unit: string
  category: string
  description: string
  priceIncludesIva: boolean
  priceLists: PriceListDraft[]
}

function createInitialForm(): ProductFormState {
  return {
    kind: PRODUCT_KIND.PRODUCT,
    sku: '',
    name: '',
    unit: '94',
    category: '',
    description: '',
    priceIncludesIva: false,
    priceLists: [{ id: 1, name: DEFAULT_PRICE_LIST_NAMES[0], price: '' }],
  }
}

function CreateProductModal({
  isOpen,
  onClose,
  onCreated,
}: CreateProductModalProps) {
  const [form, setForm] = useState<ProductFormState>(createInitialForm)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isCancelOpen, setIsCancelOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [categories, setCategories] = useState<ProductCategory[]>([])
  // El usuario editó el SKU a mano: dejamos de auto-sugerirlo al cambiar de tipo.
  const [skuTouched, setSkuTouched] = useState(false)
  // Sembrado con la opción por defecto para que "Unidad - 94" se vea al
  // instante, antes de que responda el catálogo de NextPyme.
  const [unitMeasures, setUnitMeasures] = useState<UnitMeasure[]>([
    DEFAULT_UNIT_MEASURE,
  ])

  // Impuestos y retenciones: siempre visible (ya no colapsable, pedido
  // explícito) — trae el catálogo REAL de la empresa (jarvis_taxes, ver
  // Impuestos y retenciones) en vez de tarifas fijas inventadas por la app.
  const [availableTaxes, setAvailableTaxes] = useState<JarvisTax[]>([])
  const [isLoadingTaxes, setIsLoadingTaxes] = useState(false)
  const [taxesError, setTaxesError] = useState<string | null>(null)
  const [selectedTaxIds, setSelectedTaxIds] = useState<Set<string>>(new Set())

  // Reinicia el formulario cada vez que el modal se abre — igual que
  // cualquier otro modal de creación de la app, no arrastra lo que haya
  // quedado de una apertura anterior.
  useEffect(() => {
    if (!isOpen) return

    setForm(createInitialForm())
    setSkuTouched(false)
    setFieldErrors({})
    setErrorMessage(null)
    setSelectedTaxIds(new Set())
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    let active = true

    fetchProductCategories()
      .then((items) => {
        if (active) setCategories(items)
      })
      .catch((error) => {
        if (active) {
          setErrorMessage(
            getApiErrorMessage(error, 'No se pudieron cargar las categorías.'),
          )
        }
      })

    return () => {
      active = false
    }
  }, [isOpen])

  // Catálogo de unidades de medida DIAN (tabla maestra de NextPyme). Si falla,
  // se conserva al menos la opción por defecto "Unidad - 94".
  useEffect(() => {
    if (!isOpen) return
    let active = true

    fetchUnitMeasures()
      .then((items) => {
        if (active && items.length > 0) setUnitMeasures(items)
      })
      .catch(() => {
        // Silencioso: queda la unidad por defecto ya seleccionada.
      })

    return () => {
      active = false
    }
  }, [isOpen])

  // Sugiere el siguiente SKU según el tipo (producto/servicio) mientras el
  // usuario no lo haya escrito a mano. El backend recuerda el último usado por
  // empresa y prefijo, así que el consecutivo no se repite aunque se olvide.
  useEffect(() => {
    if (!isOpen || skuTouched) return

    let active = true

    fetchNextSku(form.kind)
      .then((sku) => {
        if (active && !skuTouched) {
          setForm((current) => ({ ...current, sku }))
        }
      })
      .catch(() => {
        // Sin sugerencia: el usuario puede escribir el SKU manualmente.
      })

    return () => {
      active = false
    }
  }, [isOpen, form.kind, skuTouched])

  // Catálogo de impuestos y retenciones de la empresa, al abrir el modal.
  // OJO: `isLoadingTaxes` NO va en las dependencias — tenerlo ahí (y
  // setearlo dentro del propio efecto) disparaba una segunda pasada del
  // efecto apenas cambiaba a true, cuya limpieza marcaba `active = false`
  // ANTES de que la petición original resolviera; el .then/.finally de esa
  // petición quedaban descartados y "Cargando..." nunca se apagaba (bug
  // real reportado: nunca traía los impuestos ya creados).
  useEffect(() => {
    if (!isOpen) return

    let active = true
    setIsLoadingTaxes(true)
    setTaxesError(null)

    fetchJarvisTaxes()
      .then((response) => {
        if (active) {
          setAvailableTaxes(response.items.filter((tax) => tax.is_active))
        }
      })
      .catch((error) => {
        if (active) {
          setTaxesError(
            getApiErrorMessage(
              error,
              'No se pudieron cargar los impuestos y retenciones.',
            ),
          )
        }
      })
      .finally(() => {
        if (active) setIsLoadingTaxes(false)
      })

    return () => {
      active = false
    }
  }, [isOpen])

  const handleCreateCategory = async (
    name: string,
  ): Promise<ProductCategory> => {
    const created = await createProductCategory(name)
    setCategories((current) =>
      [...current, created].sort((a, b) => a.name.localeCompare(b.name)),
    )
    return created
  }

  const handleEditCategory = async (
    id: string,
    name: string,
  ): Promise<ProductCategory> => {
    const updated = await updateProductCategory(id, name)
    setCategories((current) =>
      current
        .map((item) => (item.id === id ? updated : item))
        .sort((a, b) => a.name.localeCompare(b.name)),
    )
    return updated
  }

  const patchForm = (partial: Partial<ProductFormState>) => {
    setForm((current) => ({ ...current, ...partial }))
  }

  const updatePriceList = (
    id: number,
    patch: Partial<Omit<PriceListDraft, 'id'>>,
  ) => {
    setForm((current) => ({
      ...current,
      priceLists: current.priceLists.map((list) =>
        list.id === id ? { ...list, ...patch } : list,
      ),
    }))
  }

  const addPriceList = () => {
    setForm((current) => {
      if (current.priceLists.length >= MAX_PRICE_LISTS) return current

      const nextId = current.priceLists.length + 1
      return {
        ...current,
        // El nombre queda vacío a propósito: "Precio 2"/"Precio 3" se ve
        // como placeholder (gris, se escribe encima), no como texto real
        // que haya que borrar primero (pedido explícito).
        priceLists: [...current.priceLists, { id: nextId, name: '', price: '' }],
      }
    })
  }

  const removePriceList = (id: number) => {
    setForm((current) => {
      if (current.priceLists.length <= 1) return current

      // Se renumeran las posiciones (1..N sin huecos) para que sigan
      // coincidiendo con lo que espera el backend.
      return {
        ...current,
        priceLists: current.priceLists
          .filter((list) => list.id !== id)
          .map((list, index) => ({ ...list, id: index + 1 })),
      }
    })
  }

  const toggleTax = (taxId: string) => {
    setSelectedTaxIds((current) => {
      const next = new Set(current)
      if (next.has(taxId)) {
        next.delete(taxId)
      } else {
        next.add(taxId)
      }
      return next
    })
  }

  const validateForm = (): Record<string, string> => {
    const errors: Record<string, string> = {}

    if (!form.sku.trim()) errors.sku = 'El código / SKU es obligatorio.'
    if (!form.name.trim()) errors.name = 'El nombre del producto es obligatorio.'
    if (!form.unit) errors.unit = 'La unidad de medida DIAN es obligatoria.'
    // La categoría dejó de ser obligatoria (pedido explícito).

    // El nombre nunca queda vacío de verdad: si el usuario no escribe nada,
    // se usa el placeholder (defaultPriceListName) como valor real al
    // enviar — no hace falta validarlo acá.
    form.priceLists.forEach((list) => {
      if (parseMoneyInput(list.price) <= 0) {
        errors[`priceValue-${list.id}`] = 'El precio de venta debe ser mayor a 0.'
      }
    })

    return errors
  }

  const buildCreateProductRequest = (): CreateProductRequest => ({
    sku: form.sku.trim(),
    name: form.name.trim(),
    kind: form.kind,
    unit: form.unit,
    categoryId: form.category || null,
    description: form.description.trim() || null,
    taxIds: [...selectedTaxIds],
    priceIncludesIva: form.priceIncludesIva,
    priceLists: form.priceLists.map((list) => ({
      position: list.id,
      name: list.name.trim() || defaultPriceListName(list.id),
      price: parseMoneyInput(list.price),
      enabled: true,
    })),
  })

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (isSubmitting) return

    const errors = validateForm()
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      setErrorMessage('Completa los campos obligatorios para crear el producto.')
      return
    }

    setFieldErrors({})
    setErrorMessage(null)
    setIsSubmitting(true)

    try {
      const response = await createProduct(buildCreateProductRequest())
      onCreated(response.product)
      onClose()
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(error, 'No se pudo crear el producto.'),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const hasUnsavedChanges = () =>
    form.sku.trim() !== '' ||
    form.name.trim() !== '' ||
    form.description.trim() !== '' ||
    selectedTaxIds.size > 0

  const requestClose = () => {
    if (isSubmitting) return

    if (hasUnsavedChanges()) {
      setIsCancelOpen(true)
      return
    }

    onClose()
  }

  const confirmCancel = () => {
    setIsCancelOpen(false)
    onClose()
  }

  const descriptionCount = form.description.length
  const selectedUnit = useMemo(
    () => unitMeasures.find((unit) => unit.code === form.unit) ?? null,
    [unitMeasures, form.unit],
  )

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={requestClose}
        busy={isSubmitting}
        labelledBy="create-product-modal-title"
        size="lg"
        className="create-product-modal"
      >
        <h2 id="create-product-modal-title" className="modal-dialog__title">
          Crear producto
        </h2>

        <form
          className="create-product-single-view"
          onSubmit={(event) => void handleSubmit(event)}
          noValidate
        >
          <section className="create-product-section">
            <h3>Información principal</h3>
            <div className="create-product-grid">
              <fieldset className="create-product-field create-product-field--wide">
                <legend>
                  Tipo <span className="create-product-req">*</span>
                </legend>
                <div className="product-segmented" role="radiogroup" aria-label="Tipo">
                  {PRODUCT_KIND_OPTIONS.map((option) => {
                    const selected = form.kind === option.value
                    return (
                      <label
                        key={option.value}
                        className={`product-segmented__option${
                          selected ? ' product-segmented__option--selected' : ''
                        }`}
                      >
                        <input
                          type="radio"
                          name="product-kind"
                          value={option.value}
                          checked={selected}
                          onChange={() => patchForm({ kind: option.value })}
                        />
                        <span className="product-radio" aria-hidden="true" />
                        {option.label}
                      </label>
                    )
                  })}
                </div>
              </fieldset>

              <label className="create-product-field">
                <span>
                  Código / SKU <span className="create-product-req">*</span>
                </span>
                <input
                  value={form.sku}
                  onChange={(event) => {
                    setSkuTouched(true)
                    patchForm({ sku: event.target.value })
                  }}
                  aria-invalid={Boolean(fieldErrors.sku)}
                />
                {fieldErrors.sku && (
                  <em className="create-product-error">{fieldErrors.sku}</em>
                )}
              </label>

              <label className="create-product-field">
                <span>
                  Nombre del producto <span className="create-product-req">*</span>
                </span>
                <input
                  value={form.name}
                  onChange={(event) => patchForm({ name: event.target.value })}
                  placeholder="Camiseta básica"
                  aria-invalid={Boolean(fieldErrors.name)}
                />
                {fieldErrors.name && (
                  <em className="create-product-error">{fieldErrors.name}</em>
                )}
              </label>

              <label className="create-product-field">
                <span>
                  Unidad de medida DIAN <span className="create-product-req">*</span>
                </span>
                <Autocomplete<UnitMeasure>
                  value={selectedUnit}
                  onChange={(unit) => patchForm({ unit: unit?.code ?? '' })}
                  options={unitMeasures}
                  placeholder="Buscar unidad..."
                  emptyMessage="No se encontraron unidades"
                  getOptionKey={(unit) => unit.code}
                  getOptionLabel={(unit) => `${unit.name} - ${unit.code}`}
                  isOptionMatch={(unit, query) =>
                    `${unit.name} - ${unit.code}`.toLowerCase().includes(query)
                  }
                  className="account-autocomplete create-product-unit"
                />
              </label>

              <label className="create-product-field">
                <span>Categoría (opcional)</span>
                <CategorySelect
                  value={form.category}
                  onChange={(categoryId) => patchForm({ category: categoryId })}
                  categories={categories}
                  onCreate={handleCreateCategory}
                  onEdit={handleEditCategory}
                  invalid={Boolean(fieldErrors.category)}
                />
                {fieldErrors.category && (
                  <em className="create-product-error">{fieldErrors.category}</em>
                )}
              </label>

              <div className="create-product-field create-product-field--wide">
                <span>Precio de venta</span>
                <div className="create-product-prices">
                  {form.priceLists.map((list, index) => (
                    <div className="create-product-price-row" key={list.id}>
                      <div className="create-product-price-row__inputs">
                        {form.priceLists.length > 1 && (
                          <input
                            className="create-product-price-row__name"
                            value={list.name}
                            onChange={(event) =>
                              updatePriceList(list.id, { name: event.target.value })
                            }
                            placeholder={defaultPriceListName(list.id)}
                          />
                        )}
                        <span className="create-product-money">
                          <span aria-hidden="true">$</span>
                          <input
                            inputMode="numeric"
                            value={formatMoneyInput(list.price)}
                            onChange={(event) =>
                              updatePriceList(list.id, {
                                price: event.target.value.replace(/[^\d]/g, ''),
                              })
                            }
                            aria-invalid={Boolean(
                              fieldErrors[`priceValue-${list.id}`],
                            )}
                          />
                        </span>
                        {form.priceLists.length > 1 && (
                          <button
                            type="button"
                            className="create-product-price-row__remove"
                            onClick={() => removePriceList(list.id)}
                            aria-label={`Quitar precio ${index + 1}`}
                          >
                            ×
                          </button>
                        )}
                      </div>
                      {fieldErrors[`priceValue-${list.id}`] && (
                        <em className="create-product-error">
                          {fieldErrors[`priceValue-${list.id}`]}
                        </em>
                      )}
                    </div>
                  ))}

                  {form.priceLists.length < MAX_PRICE_LISTS && (
                    <button
                      type="button"
                      className="create-product-price-add"
                      onClick={addPriceList}
                    >
                      + Agregar otro precio
                    </button>
                  )}
                </div>
              </div>

              <label className="create-product-field create-product-field--wide">
                <span>Descripción (opcional)</span>
                <textarea
                  rows={3}
                  maxLength={PRODUCT_DESCRIPTION_MAX_LENGTH}
                  value={form.description}
                  onChange={(event) =>
                    patchForm({ description: event.target.value })
                  }
                  placeholder="Camiseta básica en algodón, diferentes tallas y colores."
                />
                <span className="create-product-counter">
                  {descriptionCount}/{PRODUCT_DESCRIPTION_MAX_LENGTH}
                </span>
              </label>
            </div>
          </section>

          <section className="create-product-section create-product-taxes-section">
            <header className="create-product-taxes-header">
              <h3>Impuestos y retenciones</h3>
              {selectedTaxIds.size > 0 && (
                <span className="create-product-taxes-count">
                  {selectedTaxIds.size} seleccionado
                  {selectedTaxIds.size === 1 ? '' : 's'}
                </span>
              )}
            </header>

            <div className="create-product-taxes-body">
              <p className="create-product-section__hint">
                Elige los impuestos y retenciones ya creados en Impuestos y
                retenciones que aplican a este producto.
              </p>

              <label className="create-product-price-includes-iva">
                <input
                  type="checkbox"
                  checked={form.priceIncludesIva}
                  onChange={(event) =>
                    patchForm({ priceIncludesIva: event.target.checked })
                  }
                />
                El precio de venta incluye IVA
              </label>

              {isLoadingTaxes ? (
                <p className="create-product-taxes-empty">Cargando...</p>
              ) : taxesError ? (
                <ErrorMessage message={taxesError} />
              ) : availableTaxes.length === 0 ? (
                <p className="create-product-taxes-empty">
                  Aún no has creado impuestos ni retenciones. Ve a "Impuestos y
                  retenciones" para agregarlos.
                </p>
              ) : (
                <ul className="create-product-taxes-list">
                  {availableTaxes.map((tax) => (
                    <li key={tax.id}>
                      <label className="create-product-taxes-item">
                        <input
                          type="checkbox"
                          checked={selectedTaxIds.has(tax.id)}
                          onChange={() => toggleTax(tax.id)}
                        />
                        <span className="create-product-taxes-item__code">
                          {tax.code}
                        </span>
                        <span className="create-product-taxes-item__name">
                          {tax.name}
                        </span>
                        <span className="create-product-taxes-item__type">
                          {tax.tax_type}
                        </span>
                        <span className="create-product-taxes-item__rate">
                          {formatTaxRate(tax)}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {errorMessage && <ErrorMessage message={errorMessage} />}

          <footer className="create-product-panel__footer">
            <Button variant="ghost" onClick={requestClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={isSubmitting}>
              {isSubmitting ? 'Creando...' : 'Crear producto'}
            </Button>
          </footer>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={isCancelOpen}
        title="¿Cancelar la creación?"
        message="Se perderán los datos que hayas ingresado en este producto."
        confirmLabel="Sí, cancelar"
        cancelLabel="Seguir editando"
        variant="danger"
        onConfirm={confirmCancel}
        onCancel={() => setIsCancelOpen(false)}
      />
    </>
  )
}

export default CreateProductModal
