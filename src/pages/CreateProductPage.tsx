import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Autocomplete from '../components/Autocomplete'
import Button from '../components/Button'
import CategorySelect from '../components/CategorySelect'
import ConfirmDialog from '../components/ConfirmDialog'
import ErrorMessage from '../components/ErrorMessage'
import PageHeader from '../components/PageHeader'
import SuccessMessage from '../components/SuccessMessage'
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  InfoIcon,
} from '../components/icons/SidebarIcons'
import { WHATSAPP_SUPPORT_HREF } from '../constants/contact'
import {
  CREATE_PRODUCT_STEPS,
  IVA_RATE_OPTIONS,
  PRODUCT_DESCRIPTION_MAX_LENGTH,
  PRODUCT_KIND,
  PRODUCT_KIND_OPTIONS,
  RETEICA_MUNICIPALITY_OPTIONS,
  RETEFUENTE_CONCEPT_OPTIONS,
  TAX_CLASSIFICATION,
  TAX_CLASSIFICATION_OPTIONS,
  formatMoneyInput,
  parseMoneyInput,
  type ProductCategory,
  type ProductKind,
  type TaxClassification,
} from '../constants/createProduct'
import { getApiErrorMessage } from '../services/apiClient'
import {
  createProduct,
  createProductCategory,
  fetchNextSku,
  fetchProductCategories,
  fetchUnitMeasures,
  updateProductCategory,
  type CreateProductRequest,
  type UnitMeasure,
} from '../services/productService'
import './CreateProductPage.css'

/** Unidad de medida DIAN por defecto: "Unidad" (código 94). Se preselecciona
 * en el formulario y se muestra mientras carga el catálogo de NextPyme. */
const DEFAULT_UNIT_MEASURE: UnitMeasure = { code: '94', name: 'Unidad' }

/** Convierte una tarifa escrita por el usuario ("2,5" o "9.66") a número, o
 * null si está vacía. El backend espera number para las columnas numeric. */
function parseRateInput(value: string): number | null {
  const normalized = value.trim().replace(',', '.')
  if (!normalized) return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

const TUTORIALS_HREF = `${WHATSAPP_SUPPORT_HREF}`

interface PriceListDraft {
  id: number
  name: string
  price: string
  enabled: boolean
}

interface ProductFormState {
  kind: ProductKind
  sku: string
  name: string
  unit: string
  category: string
  description: string
  priceLists: PriceListDraft[]
  applyIva: boolean
  taxClassification: TaxClassification
  ivaRate: string
  priceIncludesIva: boolean
  retefuenteEnabled: boolean
  retefuenteConcept: string
  retefuenteRate: string
  retefuenteMinBase: string
  reteicaEnabled: boolean
  reteicaMunicipality: string
  reteicaRate: string
  reteicaMinBase: string
  reteivaEnabled: boolean
  reteivaRate: string
}

function createInitialForm(): ProductFormState {
  return {
    kind: PRODUCT_KIND.PRODUCT,
    sku: '',
    name: '',
    unit: '94',
    category: '',
    description: '',
    priceLists: [
      { id: 1, name: 'Precio general', price: '50000', enabled: true },
      { id: 2, name: 'Mayorista', price: '0', enabled: false },
      { id: 3, name: 'Distribuidor', price: '0', enabled: false },
    ],
    applyIva: true,
    taxClassification: TAX_CLASSIFICATION.TAXED,
    ivaRate: '19',
    priceIncludesIva: true,
    retefuenteEnabled: true,
    retefuenteConcept: 'Compras',
    retefuenteRate: '2,5',
    retefuenteMinBase: '0',
    reteicaEnabled: true,
    reteicaMunicipality: 'Bogotá D.C.',
    reteicaRate: '9,66',
    reteicaMinBase: '0',
    reteivaEnabled: true,
    reteivaRate: '15',
  }
}

function SwitchControl({
  checked,
  onChange,
  labelledBy,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  labelledBy: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      className={`product-switch${checked ? ' product-switch--on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className="product-switch__thumb" />
    </button>
  )
}

function CreateProductPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<ProductFormState>(createInitialForm)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
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

  useEffect(() => {
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
  }, [])

  // Catálogo de unidades de medida DIAN (tabla maestra de NextPyme). Si falla,
  // se conserva al menos la opción por defecto "Unidad - 94".
  useEffect(() => {
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
  }, [])

  // Sugiere el siguiente SKU según el tipo (producto/servicio) mientras el
  // usuario no lo haya escrito a mano. El backend recuerda el último usado por
  // empresa y prefijo, así que el consecutivo no se repite aunque se olvide.
  useEffect(() => {
    if (skuTouched) return

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
  }, [form.kind, skuTouched])

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

  const currentStep = CREATE_PRODUCT_STEPS[step]
  const isLastStep = step === CREATE_PRODUCT_STEPS.length - 1

  const patchForm = (partial: Partial<ProductFormState>) => {
    setForm((current) => ({ ...current, ...partial }))
    setSuccessMessage(null)
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
    setSuccessMessage(null)
  }

  const validateStep = (index: number): Record<string, string> => {
    const errors: Record<string, string> = {}

    if (index === 0) {
      if (!form.sku.trim()) errors.sku = 'El código / SKU es obligatorio.'
      if (!form.name.trim()) errors.name = 'El nombre del producto es obligatorio.'
      if (!form.unit) errors.unit = 'La unidad de medida DIAN es obligatoria.'
      if (!form.category.trim()) errors.category = 'La categoría es obligatoria.'
    }

    if (index === 1) {
      const activeLists = form.priceLists.filter((list) => list.enabled)
      if (activeLists.length === 0) {
        errors.priceLists = 'Debes tener al menos una lista de precios activa.'
      }

      activeLists.forEach((list) => {
        if (!list.name.trim()) {
          errors[`priceName-${list.id}`] = 'El nombre de la lista es obligatorio.'
        }
        if (parseMoneyInput(list.price) <= 0) {
          errors[`priceValue-${list.id}`] = 'El precio de venta debe ser mayor a 0.'
        }
      })
    }

    if (index === 2 && form.applyIva) {
      if (!form.taxClassification) {
        errors.taxClassification = 'La clasificación tributaria es obligatoria.'
      }
      if (!form.ivaRate) errors.ivaRate = 'La tarifa de IVA es obligatoria.'
    }

    if (index === 3) {
      if (form.retefuenteEnabled) {
        if (!form.retefuenteConcept) {
          errors.retefuenteConcept = 'Selecciona un concepto.'
        }
        if (!form.retefuenteRate.trim()) {
          errors.retefuenteRate = 'La tarifa es obligatoria.'
        }
      }
      if (form.reteicaEnabled) {
        if (!form.reteicaMunicipality) {
          errors.reteicaMunicipality = 'Selecciona un municipio.'
        }
        if (!form.reteicaRate.trim()) {
          errors.reteicaRate = 'La tarifa es obligatoria.'
        }
      }
    }

    return errors
  }

  const goToStep = (nextIndex: number) => {
    if (nextIndex < 0 || nextIndex >= CREATE_PRODUCT_STEPS.length) return

    if (nextIndex > step) {
      for (let index = step; index < nextIndex; index += 1) {
        const errors = validateStep(index)
        if (Object.keys(errors).length > 0) {
          setFieldErrors(errors)
          setErrorMessage('Revisa los campos obligatorios de este paso para continuar.')
          setStep(index)
          return
        }
      }
    }

    setFieldErrors({})
    setErrorMessage(null)
    setStep(nextIndex)
  }

  const handleNext = () => {
    const errors = validateStep(step)
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      setErrorMessage('Completa los campos obligatorios para continuar.')
      return
    }

    setFieldErrors({})
    setErrorMessage(null)
    setStep((current) => Math.min(current + 1, CREATE_PRODUCT_STEPS.length - 1))
  }

  const buildCreateProductRequest = (): CreateProductRequest => ({
    sku: form.sku.trim(),
    name: form.name.trim(),
    kind: form.kind,
    unit: form.unit,
    categoryId: form.category || null,
    description: form.description.trim() || null,
    applyIva: form.applyIva,
    taxClassification: form.applyIva ? form.taxClassification : null,
    ivaRate: form.applyIva ? parseRateInput(form.ivaRate) : null,
    priceIncludesIva: form.priceIncludesIva,
    retefuenteEnabled: form.retefuenteEnabled,
    retefuenteConcept: form.retefuenteEnabled ? form.retefuenteConcept : null,
    retefuenteRate: form.retefuenteEnabled
      ? parseRateInput(form.retefuenteRate)
      : null,
    retefuenteMinBase: form.retefuenteEnabled
      ? parseMoneyInput(form.retefuenteMinBase)
      : null,
    reteicaEnabled: form.reteicaEnabled,
    reteicaMunicipality: form.reteicaEnabled ? form.reteicaMunicipality : null,
    reteicaRate: form.reteicaEnabled ? parseRateInput(form.reteicaRate) : null,
    reteicaMinBase: form.reteicaEnabled
      ? parseMoneyInput(form.reteicaMinBase)
      : null,
    reteivaEnabled: form.reteivaEnabled,
    reteivaRate: form.reteivaEnabled ? parseRateInput(form.reteivaRate) : null,
    priceLists: form.priceLists.map((list) => ({
      position: list.id,
      name: list.name.trim(),
      price: parseMoneyInput(list.price),
      enabled: list.enabled,
    })),
  })

  const submitProduct = async () => {
    if (isSubmitting) return

    // Solo se crea desde el último paso (Retenciones). Si por cualquier razón
    // se invoca antes, se avanza en vez de crear.
    if (!isLastStep) {
      handleNext()
      return
    }

    const errors = validateStep(step)
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      setErrorMessage('Completa los campos obligatorios para crear el producto.')
      return
    }

    setErrorMessage(null)
    setSuccessMessage(null)
    setIsSubmitting(true)

    try {
      const response = await createProduct(buildCreateProductRequest())
      const activeLists = response.product.priceLists.filter(
        (list) => list.enabled,
      )
      setSuccessMessage(
        `Producto "${response.product.name}" creado en Jarvis (${response.product.sku}, ${activeLists.length} lista${activeLists.length === 1 ? '' : 's'} de precio activa${activeLists.length === 1 ? '' : 's'}).`,
      )
      setForm(createInitialForm())
      setSkuTouched(false)
      setStep(0)
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(error, 'No se pudo crear el producto.'),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    // El envío del formulario (Enter en un campo) NO crea el producto: la
    // creación solo ocurre con el botón "Crear producto" (onClick). Así se
    // evita que un submit implícito se cuele al avanzar entre pasos, que era
    // lo que "saltaba" el paso de Retenciones y creaba el producto solo.
    event.preventDefault()
  }

  const confirmCancel = () => {
    setIsCancelOpen(false)
    setForm(createInitialForm())
    setSkuTouched(false)
    setStep(0)
    setFieldErrors({})
    setErrorMessage(null)
    setSuccessMessage(null)
    navigate('/productos/crear')
  }

  const descriptionCount = form.description.length
  const selectedUnit = useMemo(
    () => unitMeasures.find((unit) => unit.code === form.unit) ?? null,
    [unitMeasures, form.unit],
  )
  const stepTitle = useMemo(() => {
    if (step === 3) return 'Retenciones (configuración predeterminada)'
    return currentStep.label
  }, [currentStep.label, step])

  return (
    <main className="create-product-page">
      <PageHeader
        title="Crear producto"
        description="Registra un nuevo producto o servicio en Jarvis."
        actions={
          <a
            className="btn btn--outline btn--sm create-product-page__tutorials"
            href={TUTORIALS_HREF}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="create-product-page__play" aria-hidden="true" />
            Ver tutoriales
          </a>
        }
      />

      <form className="create-product-sheet" onSubmit={handleSubmit} noValidate>
        <aside className="create-product-steps" aria-label="Pasos para crear producto">
          <ol className="create-product-steps__list">
            {CREATE_PRODUCT_STEPS.map((item, index) => {
              const isActive = index === step
              const isComplete = index < step

              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={[
                      'create-product-steps__item',
                      isActive ? 'create-product-steps__item--active' : '',
                      isComplete ? 'create-product-steps__item--complete' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => goToStep(index)}
                  >
                    <span className="create-product-steps__badge" aria-hidden="true">
                      {isComplete ? <CheckIcon /> : item.id}
                    </span>
                    <span className="create-product-steps__copy">
                      <strong>{item.label}</strong>
                      <small>{item.description}</small>
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        </aside>

        <div className="create-product-panel">
          <header className="create-product-panel__header">
            <h2>{stepTitle}</h2>
            <p>
              {step === 1
                ? 'Configura las listas de precios que necesites. Debes tener al menos una lista activa.'
                : step === 3
                  ? 'Estas retenciones se sugerirán al facturar. Podrás modificarlas en cada documento.'
                  : currentStep.description}
            </p>
          </header>

          <div key={step} className="create-product-panel__body">
            {step === 0 && (
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
                    onChange={(unit) =>
                      patchForm({ unit: unit?.code ?? '' })
                    }
                    options={unitMeasures}
                    placeholder="Buscar unidad..."
                    emptyMessage="No se encontraron unidades"
                    getOptionKey={(unit) => unit.code}
                    getOptionLabel={(unit) => `${unit.name} - ${unit.code}`}
                    isOptionMatch={(unit, query) =>
                      `${unit.name} - ${unit.code}`
                        .toLowerCase()
                        .includes(query)
                    }
                    className="account-autocomplete create-product-unit"
                  />
                </label>

                <label className="create-product-field">
                  <span>
                    Categoría <span className="create-product-req">*</span>
                  </span>
                  <CategorySelect
                    value={form.category}
                    onChange={(categoryId) =>
                      patchForm({ category: categoryId })
                    }
                    categories={categories}
                    onCreate={handleCreateCategory}
                    onEdit={handleEditCategory}
                    invalid={Boolean(fieldErrors.category)}
                  />
                  {fieldErrors.category && (
                    <em className="create-product-error">
                      {fieldErrors.category}
                    </em>
                  )}
                </label>

                <label className="create-product-field create-product-field--wide">
                  <span>Descripción (opcional)</span>
                  <textarea
                    rows={4}
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
            )}

            {step === 1 && (
              <div className="create-product-lists">
                {fieldErrors.priceLists && (
                  <p className="create-product-error">{fieldErrors.priceLists}</p>
                )}
                {form.priceLists.map((list) => (
                  <section
                    key={list.id}
                    className={`price-list-card${
                      list.enabled ? ' price-list-card--active' : ''
                    }`}
                  >
                    <header className="price-list-card__header">
                      <div className="price-list-card__title">
                        <SwitchControl
                          checked={list.enabled}
                          onChange={(enabled) =>
                            updatePriceList(list.id, { enabled })
                          }
                          labelledBy={`price-list-${list.id}`}
                        />
                        <strong id={`price-list-${list.id}`}>
                          Lista de precios {list.id}
                        </strong>
                      </div>
                      <span
                        className={`price-list-card__status${
                          list.enabled ? ' price-list-card__status--on' : ''
                        }`}
                      >
                        {list.enabled ? 'ACTIVA' : 'DESACTIVADA'}
                      </span>
                    </header>

                    <div className="create-product-grid">
                      <label className="create-product-field">
                        <span>Nombre de la lista {list.enabled ? '*' : ''}</span>
                        <input
                          value={list.name}
                          disabled={!list.enabled}
                          onChange={(event) =>
                            updatePriceList(list.id, { name: event.target.value })
                          }
                          aria-invalid={Boolean(fieldErrors[`priceName-${list.id}`])}
                        />
                        {fieldErrors[`priceName-${list.id}`] && (
                          <em className="create-product-error">
                            {fieldErrors[`priceName-${list.id}`]}
                          </em>
                        )}
                      </label>
                      <label className="create-product-field">
                        <span>Precio de venta</span>
                        <span className="create-product-money">
                          <span aria-hidden="true">$</span>
                          <input
                            inputMode="numeric"
                            value={formatMoneyInput(list.price)}
                            disabled={!list.enabled}
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
                        {fieldErrors[`priceValue-${list.id}`] && (
                          <em className="create-product-error">
                            {fieldErrors[`priceValue-${list.id}`]}
                          </em>
                        )}
                      </label>
                    </div>
                  </section>
                ))}
              </div>
            )}

            {step === 2 && (
              <div className="create-product-tax">
                <div className="tax-toggle-row">
                  <SwitchControl
                    checked={form.applyIva}
                    onChange={(applyIva) => patchForm({ applyIva })}
                    labelledBy="apply-iva-label"
                  />
                  <strong id="apply-iva-label">Aplicar IVA</strong>
                </div>

                <div className="create-product-grid">
                  <label className="create-product-field">
                    <span>
                      Clasificación tributaria{' '}
                      <span className="create-product-req">*</span>
                    </span>
                    <select
                      value={form.taxClassification}
                      disabled={!form.applyIva}
                      onChange={(event) =>
                        patchForm({
                          taxClassification: event.target.value as TaxClassification,
                        })
                      }
                    >
                      {TAX_CLASSIFICATION_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="create-product-field">
                    <span>
                      Tarifa <span className="create-product-req">*</span>
                    </span>
                    <select
                      value={form.ivaRate}
                      disabled={!form.applyIva}
                      onChange={(event) => patchForm({ ivaRate: event.target.value })}
                    >
                      {IVA_RATE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <fieldset className="create-product-field">
                  <legend>El precio incluye IVA</legend>
                  <div className="product-segmented" role="radiogroup">
                    {[
                      { value: true, label: 'Sí' },
                      { value: false, label: 'No' },
                    ].map((option) => {
                      const selected = form.priceIncludesIva === option.value
                      return (
                        <label
                          key={String(option.value)}
                          className={`product-segmented__option${
                            selected ? ' product-segmented__option--selected' : ''
                          }`}
                        >
                          <input
                            type="radio"
                            name="price-includes-iva"
                            checked={selected}
                            disabled={!form.applyIva}
                            onChange={() =>
                              patchForm({ priceIncludesIva: option.value })
                            }
                          />
                          <span className="product-radio" aria-hidden="true" />
                          {option.label}
                        </label>
                      )
                    })}
                  </div>
                </fieldset>

                {form.applyIva && form.priceIncludesIva && (
                  <p className="create-product-info">
                    <InfoIcon />
                    El precio de venta que configure incluye el valor del IVA.
                  </p>
                )}
              </div>
            )}

            {step === 3 && (
              <div className="retention-grid">
                <section
                  className={`retention-card${
                    form.retefuenteEnabled ? ' retention-card--on' : ''
                  }`}
                >
                  <header className="retention-card__header">
                    <SwitchControl
                      checked={form.retefuenteEnabled}
                      onChange={(retefuenteEnabled) =>
                        patchForm({ retefuenteEnabled })
                      }
                      labelledBy="retefuente-label"
                    />
                    <strong id="retefuente-label">Retención en la fuente</strong>
                  </header>
                  <label className="create-product-field">
                    <span>Concepto</span>
                    <select
                      value={form.retefuenteConcept}
                      disabled={!form.retefuenteEnabled}
                      onChange={(event) =>
                        patchForm({ retefuenteConcept: event.target.value })
                      }
                    >
                      {RETEFUENTE_CONCEPT_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="create-product-field">
                    <span>Tarifa</span>
                    <span className="create-product-suffix">
                      <input
                        value={form.retefuenteRate}
                        disabled={!form.retefuenteEnabled}
                        onChange={(event) =>
                          patchForm({ retefuenteRate: event.target.value })
                        }
                      />
                      <span>%</span>
                    </span>
                  </label>
                  <label className="create-product-field">
                    <span>Base mínima (opcional)</span>
                    <span className="create-product-money">
                      <span aria-hidden="true">$</span>
                      <input
                        inputMode="numeric"
                        value={formatMoneyInput(form.retefuenteMinBase)}
                        disabled={!form.retefuenteEnabled}
                        onChange={(event) =>
                          patchForm({
                            retefuenteMinBase: event.target.value.replace(
                              /[^\d]/g,
                              '',
                            ),
                          })
                        }
                      />
                    </span>
                  </label>
                </section>

                <section
                  className={`retention-card${
                    form.reteicaEnabled ? ' retention-card--on' : ''
                  }`}
                >
                  <header className="retention-card__header">
                    <SwitchControl
                      checked={form.reteicaEnabled}
                      onChange={(reteicaEnabled) => patchForm({ reteicaEnabled })}
                      labelledBy="reteica-label"
                    />
                    <strong id="reteica-label">ReteICA</strong>
                  </header>
                  <label className="create-product-field">
                    <span>Municipio</span>
                    <select
                      value={form.reteicaMunicipality}
                      disabled={!form.reteicaEnabled}
                      onChange={(event) =>
                        patchForm({ reteicaMunicipality: event.target.value })
                      }
                    >
                      {RETEICA_MUNICIPALITY_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="create-product-field">
                    <span>Tarifa</span>
                    <span className="create-product-suffix">
                      <input
                        value={form.reteicaRate}
                        disabled={!form.reteicaEnabled}
                        onChange={(event) =>
                          patchForm({ reteicaRate: event.target.value })
                        }
                      />
                      <span>%</span>
                    </span>
                  </label>
                  <label className="create-product-field">
                    <span>Base mínima (opcional)</span>
                    <span className="create-product-money">
                      <span aria-hidden="true">$</span>
                      <input
                        inputMode="numeric"
                        value={formatMoneyInput(form.reteicaMinBase)}
                        disabled={!form.reteicaEnabled}
                        onChange={(event) =>
                          patchForm({
                            reteicaMinBase: event.target.value.replace(/[^\d]/g, ''),
                          })
                        }
                      />
                    </span>
                  </label>
                </section>

                <section
                  className={`retention-card${
                    form.reteivaEnabled ? ' retention-card--on' : ''
                  }`}
                >
                  <header className="retention-card__header">
                    <SwitchControl
                      checked={form.reteivaEnabled}
                      onChange={(reteivaEnabled) => patchForm({ reteivaEnabled })}
                      labelledBy="reteiva-label"
                    />
                    <strong id="reteiva-label">ReteIVA</strong>
                  </header>
                  <label className="create-product-field">
                    <span>Tarifa</span>
                    <span className="create-product-suffix">
                      <input
                        value={form.reteivaRate}
                        disabled={!form.reteivaEnabled}
                        onChange={(event) =>
                          patchForm({ reteivaRate: event.target.value })
                        }
                      />
                      <span>%</span>
                    </span>
                  </label>
                  <p className="create-product-note">
                    <InfoIcon />
                    La ReteIVA se aplicará solo si el producto genera IVA.
                  </p>
                </section>
              </div>
            )}
          </div>

          {errorMessage && <ErrorMessage message={errorMessage} />}
          {successMessage && <SuccessMessage message={successMessage} />}

          <footer className="create-product-panel__footer">
            {step === 0 ? (
              <Button variant="ghost" onClick={() => setIsCancelOpen(true)}>
                Cancelar
              </Button>
            ) : (
              <Button variant="ghost" onClick={() => goToStep(step - 1)}>
                <ChevronLeftIcon /> Anterior
              </Button>
            )}

            {isLastStep ? (
              <Button
                key="create-product"
                type="button"
                variant="primary"
                disabled={isSubmitting}
                onClick={submitProduct}
              >
                {isSubmitting ? 'Creando...' : 'Crear producto'} <CheckIcon />
              </Button>
            ) : (
              <Button
                key="next-step"
                type="button"
                variant="primary"
                onClick={handleNext}
              >
                Siguiente <ChevronRightIcon />
              </Button>
            )}
          </footer>
        </div>
      </form>

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
    </main>
  )
}

export default CreateProductPage
