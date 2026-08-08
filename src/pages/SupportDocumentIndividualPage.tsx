import {
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ErrorMessage from '../components/ErrorMessage'
import SuccessMessage from '../components/SuccessMessage'
import { getApiErrorMessage } from '../services/apiClient'
import {
  createManualJarvisSupportDocument,
  fetchJarvisCatalogs,
  fetchJarvisCredentialsStatus,
  fetchJarvisTerceros,
  type JarvisCatalogItem,
} from '../services/jarvisService'
import type { JarvisTercero } from '../types/jarvis'
import './SupportDocumentIndividualPage.css'

const DEFAULT_IVA_PERCENT = 19

/** Monedas frecuentes; se cruzan con la tabla maestra type_currencies. */
const COMMON_CURRENCY_CODES = [
  'COP',
  'USD',
  'EUR',
  'GBP',
  'MXN',
  'BRL',
  'ARS',
  'CLP',
  'PEN',
  'CAD',
  'CHF',
  'JPY',
  'CNY',
  'AUD',
] as const

const CURRENCY_LABELS: Record<string, string> = {
  COP: 'Peso colombiano',
  USD: 'Dólar estadounidense',
  EUR: 'Euro',
  GBP: 'Libra esterlina',
  MXN: 'Peso mexicano',
  BRL: 'Real brasileño',
  ARS: 'Peso argentino',
  CLP: 'Peso chileno',
  PEN: 'Sol peruano',
  CAD: 'Dólar canadiense',
  CHF: 'Franco suizo',
  JPY: 'Yen japonés',
  CNY: 'Yuan chino',
  AUD: 'Dólar australiano',
}

interface LineItem {
  id: string
  lineType: 'producto' | 'servicio'
  code: string
  description: string
  quantity: string
  unitValue: string
  discount: string
  taxChargeId: string
  taxRetentionId: string
  taxPercent: string
}

function todayLocalDate(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function createEmptyLine(): LineItem {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    lineType: 'producto',
    code: '',
    description: '',
    quantity: '1',
    unitValue: '0',
    discount: '0',
    taxChargeId: '',
    taxRetentionId: '',
    taxPercent: String(DEFAULT_IVA_PERCENT),
  }
}

function parseAmount(value: string): number {
  const normalized = value.replace(/\s/g, '').replace(',', '.')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatMoney(value: number): string {
  return value.toLocaleString('es-CO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function isIvaTax(tax: JarvisCatalogItem | undefined): boolean {
  if (!tax) return false
  const label = `${tax.name ?? ''} ${tax.code ?? ''}`.toUpperCase()
  return label.includes('IVA') && !label.includes('RETE')
}

function isRetentionTax(tax: JarvisCatalogItem): boolean {
  const label = `${tax.name ?? ''} ${tax.type ?? ''}`.toUpperCase()
  return (
    label.includes('RETE') ||
    label.includes('RETENC') ||
    label.includes('RENTA') ||
    label.includes('ICA')
  )
}

function lineBaseTotal(line: LineItem): number {
  const quantity = Math.max(0, parseAmount(line.quantity))
  const unitValue = Math.max(0, parseAmount(line.unitValue))
  const discount = Math.max(0, parseAmount(line.discount))
  return Math.max(0, quantity * unitValue - discount)
}

function lineTaxAmount(line: LineItem): number {
  const taxId = Number(line.taxChargeId)
  if (!Number.isFinite(taxId) || taxId <= 0) return 0
  const percent = Math.max(0, parseAmount(line.taxPercent) || DEFAULT_IVA_PERCENT)
  return Math.round((lineBaseTotal(line) * percent + Number.EPSILON) * 100) / 100
}

function lineTotal(line: LineItem): number {
  return lineBaseTotal(line) + lineTaxAmount(line)
}

function daysBetween(fromDate: string, toDate: string): number {
  const from = new Date(`${fromDate}T00:00:00`)
  const to = new Date(`${toDate}T00:00:00`)
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 0
  const diff = Math.round((to.getTime() - from.getTime()) / 86_400_000)
  return Math.max(0, diff)
}

type SubmitMode = 'save' | 'save-new' | 'send'

function SupportDocumentIndividualPage() {
  const navigate = useNavigate()
  const [issueDate, setIssueDate] = useState(todayLocalDate)
  const [dueDate, setDueDate] = useState(todayLocalDate)
  const [documentPrefix, setDocumentPrefix] = useState('DS')
  const [documentNumber, setDocumentNumber] = useState('')
  const [currency, setCurrency] = useState('COP')
  const [notes, setNotes] = useState('')
  const [supplierQuery, setSupplierQuery] = useState('')
  const [selectedSupplier, setSelectedSupplier] = useState<JarvisTercero | null>(
    null,
  )
  const [allSuppliers, setAllSuppliers] = useState<JarvisTercero[]>([])
  const [isSupplierMenuOpen, setIsSupplierMenuOpen] = useState(false)
  const [isLoadingSuppliers, setIsLoadingSuppliers] = useState(false)
  const [lines, setLines] = useState<LineItem[]>([createEmptyLine()])
  const [taxes, setTaxes] = useState<JarvisCatalogItem[]>([])
  const [paymentMethods, setPaymentMethods] = useState<JarvisCatalogItem[]>([])
  const [paymentForms, setPaymentForms] = useState<JarvisCatalogItem[]>([])
  const [currencies, setCurrencies] = useState<JarvisCatalogItem[]>([])
  const [paymentMethodId, setPaymentMethodId] = useState('')
  const [paymentFormId, setPaymentFormId] = useState('1')
  const [nextConsecutive, setNextConsecutive] = useState<number | null>(null)
  const [resolutionPrefix, setResolutionPrefix] = useState('DS')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitMode, setSubmitMode] = useState<SubmitMode | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const supplierBlurTimeoutRef = useRef<number | null>(null)

  const chargeTaxes = taxes.filter((tax) => !isRetentionTax(tax))
  const retentionTaxes = taxes.filter((tax) => isRetentionTax(tax))
  const currencyOptions = (() => {
    const matched = COMMON_CURRENCY_CODES.map((code) => {
      const master = currencies.find(
        (item) => (item.code ?? '').trim().toUpperCase() === code,
      )
      return {
        code,
        id: master?.id ?? null,
        label: `${code} - ${CURRENCY_LABELS[code] ?? master?.name ?? code}`,
        available: Boolean(master),
      }
    }).filter((option) => option.available)

    if (matched.length > 0) {
      return matched
    }

    if (currencies.length > 0) {
      return currencies.slice(0, 20).map((item) => {
        const code = (item.code ?? item.name ?? String(item.id)).toUpperCase()
        return {
          code,
          id: item.id,
          label: item.code
            ? `${item.code} - ${item.name}`
            : item.name || code,
          available: true,
        }
      })
    }

    return [
      {
        code: 'COP',
        id: null as number | null,
        label: 'COP - Peso colombiano',
        available: false,
      },
    ]
  })()

  const isCreditPayment = paymentFormId === '2'
  const documentSubtotal = lines.reduce((sum, line) => sum + lineBaseTotal(line), 0)
  const documentTax = lines.reduce((sum, line) => sum + lineTaxAmount(line), 0)
  const documentTotal = documentSubtotal + documentTax

  const filteredSuppliers = (() => {
    const query = supplierQuery.trim().toLowerCase()
    if (!query) return allSuppliers

    if (
      selectedSupplier &&
      `${selectedSupplier.document_number} — ${selectedSupplier.name}`.toLowerCase() ===
        query
    ) {
      return [selectedSupplier]
    }

    return allSuppliers.filter((item) => {
      const name = item.name.toLowerCase()
      const documentNumber = item.document_number.toLowerCase()
      return name.includes(query) || documentNumber.includes(query)
    })
  })()

  useEffect(() => {
    let cancelled = false

    async function loadSuppliers() {
      setIsLoadingSuppliers(true)
      try {
        const response = await fetchJarvisTerceros()
        if (!cancelled) {
          setAllSuppliers(response.items ?? [])
        }
      } catch {
        if (!cancelled) {
          setAllSuppliers([])
        }
      } finally {
        if (!cancelled) {
          setIsLoadingSuppliers(false)
        }
      }
    }

    void loadSuppliers()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadCatalogs() {
      try {
        const [catalogs, status] = await Promise.all([
          fetchJarvisCatalogs(),
          fetchJarvisCredentialsStatus(),
        ])

        if (cancelled) return

        setTaxes(catalogs.taxes ?? [])
        setPaymentMethods(catalogs.paymentMethods ?? [])
        setPaymentForms(catalogs.paymentForms ?? [])
        setCurrencies(catalogs.currencies ?? [])
        if (catalogs.paymentMethods?.[0]) {
          setPaymentMethodId(String(catalogs.paymentMethods[0].id))
        }
        if (catalogs.paymentForms?.[0]) {
          setPaymentFormId(String(catalogs.paymentForms[0].id))
        }

        const hasCop = (catalogs.currencies ?? []).some(
          (item) => (item.code ?? '').trim().toUpperCase() === 'COP',
        )
        if (!hasCop) {
          const firstCurrency = catalogs.currencies?.[0]?.code?.trim()
          if (firstCurrency) {
            setCurrency(firstCurrency.toUpperCase())
          }
        }

        const ivaDefault = (catalogs.taxes ?? []).find((tax) => isIvaTax(tax))
        if (ivaDefault) {
          setLines((current) =>
            current.map((line) =>
              line.taxChargeId
                ? line
                : {
                    ...line,
                    taxChargeId: String(ivaDefault.id),
                    taxPercent: String(DEFAULT_IVA_PERCENT),
                  },
            ),
          )
        }

        const resolution = status.supportDocumentResolution
        if (resolution?.nextConsecutive != null) {
          setNextConsecutive(resolution.nextConsecutive)
        }
        if (resolution?.prefix?.trim()) {
          setResolutionPrefix(resolution.prefix.trim())
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            getApiErrorMessage(
              error,
              'No se pudieron cargar los catálogos de documento soporte.',
            ),
          )
        }
      }
    }

    void loadCatalogs()

    return () => {
      cancelled = true
    }
  }, [])

  const resetForm = useCallback(() => {
    setIssueDate(todayLocalDate())
    setDueDate(todayLocalDate())
    setDocumentNumber('')
    setNotes('')
    setSupplierQuery('')
    setSelectedSupplier(null)
    setIsSupplierMenuOpen(false)
    setLines([createEmptyLine()])
    setFieldErrors({})
    setErrorMessage(null)
  }, [])

  const updateLine = useCallback(
    (lineId: string, patch: Partial<LineItem>) => {
      setLines((current) =>
        current.map((line) =>
          line.id === lineId ? { ...line, ...patch } : line,
        ),
      )
    },
    [],
  )

  const removeLine = useCallback((lineId: string) => {
    setLines((current) => {
      if (current.length <= 1) return current
      return current.filter((line) => line.id !== lineId)
    })
  }, [])

  const selectSupplier = useCallback((tercero: JarvisTercero) => {
    setSelectedSupplier(tercero)
    setSupplierQuery(`${tercero.document_number} — ${tercero.name}`)
    setIsSupplierMenuOpen(false)
    setFieldErrors((current) => {
      const next = { ...current }
      delete next.supplier
      return next
    })
  }, [])

  const validate = useCallback((): boolean => {
    const nextErrors: Record<string, string> = {}

    if (!selectedSupplier) {
      nextErrors.supplier = 'Debe seleccionar un proveedor.'
    }

    if (!issueDate.trim()) {
      nextErrors.issueDate = 'La fecha es obligatoria.'
    }

    if (!documentNumber.trim()) {
      nextErrors.documentNumber = 'No puede estar vacío'
    }

    if (!paymentMethodId) {
      nextErrors.paymentMethod = 'Selecciona un medio de pago.'
    }

    if (isCreditPayment && !dueDate.trim()) {
      nextErrors.dueDate = 'La fecha de vencimiento es obligatoria a crédito.'
    }

    const hasValidLine = lines.some(
      (line) =>
        line.description.trim() &&
        parseAmount(line.quantity) > 0 &&
        parseAmount(line.unitValue) > 0,
    )

    if (!hasValidLine) {
      nextErrors.lines =
        'Agrega al menos un ítem con descripción, cantidad y valor.'
    }

    lines.forEach((line, index) => {
      if (!line.description.trim()) {
        nextErrors[`line-${index}-description`] = 'No puede estar vacío'
      }
      if (parseAmount(line.quantity) <= 0) {
        nextErrors[`line-${index}-quantity`] = 'Cantidad inválida'
      }
    })

    setFieldErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }, [
    documentNumber,
    dueDate,
    isCreditPayment,
    issueDate,
    lines,
    paymentMethodId,
    selectedSupplier,
  ])

  const buildRequest = useCallback(
    (send: boolean) => {
      if (!selectedSupplier) {
        throw new Error('Debe seleccionar un proveedor.')
      }

      const taxesById = new Map(taxes.map((tax) => [tax.id, tax]))
      const retentions = lines
        .map((line) => {
          const retentionId = Number(line.taxRetentionId)
          if (!Number.isFinite(retentionId) || retentionId <= 0) return null
          const tax = taxesById.get(retentionId)
          return {
            id: retentionId,
            type: tax?.type ?? tax?.name,
            percentage: tax?.percentage ?? undefined,
          }
        })
        .filter((item): item is NonNullable<typeof item> => item != null)

      const uniqueRetentions = Array.from(
        new Map(retentions.map((item) => [item.id, item])).values(),
      )

      const paymentId = Number(paymentMethodId)
      const formId = Number(paymentFormId)
      const paymentDueDate = isCreditPayment
        ? dueDate.trim() || issueDate.trim()
        : issueDate.trim()

      return {
        issueDate: issueDate.trim(),
        supplierDocumentType: selectedSupplier.document_type,
        supplierIdentification: selectedSupplier.document_number,
        supplierName: selectedSupplier.name,
        currency,
        documentPrefix: documentPrefix.trim() || 'DS',
        documentNumber: documentNumber.trim(),
        ...(notes.trim() ? { observations: notes.trim() } : {}),
        items: lines
          .filter((line) => line.description.trim())
          .map((line) => ({
            description: line.description.trim(),
            quantity: parseAmount(line.quantity),
            unitValue: parseAmount(line.unitValue),
            discount: parseAmount(line.discount),
            taxAmount: lineTaxAmount(line),
            ...(line.code.trim() ? { code: line.code.trim() } : {}),
          })),
        ...(uniqueRetentions.length > 0
          ? { retentions: uniqueRetentions }
          : {}),
        ...(Number.isFinite(paymentId) && paymentId > 0
          ? {
              payment: {
                id: paymentId,
                payment_form_id: Number.isFinite(formId) ? formId : 1,
                due_date: paymentDueDate,
              },
            }
          : {}),
        send,
      }
    },
    [
      documentNumber,
      documentPrefix,
      dueDate,
      currency,
      isCreditPayment,
      issueDate,
      lines,
      notes,
      paymentFormId,
      paymentMethodId,
      selectedSupplier,
      taxes,
    ],
  )

  const handleSubmit = useCallback(
    async (mode: SubmitMode) => {
      setErrorMessage(null)
      setSuccessMessage(null)

      if (!validate()) {
        setErrorMessage('Revisa los campos marcados antes de continuar.')
        return
      }

      setIsSubmitting(true)
      setSubmitMode(mode)

      try {
        const send = mode === 'send'
        const response = await createManualJarvisSupportDocument(
          buildRequest(send),
        )

        if (mode === 'send') {
          const consecutive =
            response.supportDocument?.consecutive ||
            response.supportDocument?.number
          setSuccessMessage(
            consecutive
              ? `Documento soporte ${response.supportDocument?.prefix ?? ''} ${consecutive} guardado y enviado a DIAN.`
              : 'Documento soporte guardado y enviado a DIAN.',
          )
          if (typeof consecutive === 'number') {
            setNextConsecutive(consecutive + 1)
          } else if (nextConsecutive != null) {
            setNextConsecutive(nextConsecutive + 1)
          }
          resetForm()
        } else if (mode === 'save-new') {
          setSuccessMessage('Documento soporte guardado correctamente.')
          resetForm()
        } else {
          setSuccessMessage('Documento soporte guardado correctamente.')
          navigate('/documento-soporte/masivo')
        }
      } catch (error) {
        setErrorMessage(
          getApiErrorMessage(
            error,
            mode === 'send'
              ? 'No se pudo guardar y enviar el documento soporte.'
              : 'No se pudo guardar el documento soporte.',
          ),
        )
      } finally {
        setIsSubmitting(false)
        setSubmitMode(null)
      }
    },
    [buildRequest, navigate, nextConsecutive, resetForm, validate],
  )

  const onFormSubmit = (event: FormEvent) => {
    event.preventDefault()
    void handleSubmit('send')
  }

  return (
    <section className="ds-individual">
      <p className="ds-individual__breadcrumb">
        <Link to="/documento-soporte">Documento Soporte</Link>
        <span aria-hidden="true"> › </span>
        <span>Nuevo documento</span>
      </p>

      <div className="ds-individual__sheet">
        <header className="ds-individual__header">
          <div className="ds-individual__header-main">
            <span className="ds-individual__doc-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"
                  strokeWidth="1.7"
                  strokeLinejoin="round"
                />
                <path d="M14 3v5h5" strokeWidth="1.7" strokeLinejoin="round" />
                <path
                  d="M9 13h6M9 17h4"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <div>
              <h1>Nuevo documento soporte</h1>
              <p>Crea tu documento soporte de forma rápida y sencilla.</p>
            </div>
          </div>
        </header>

        {errorMessage && <ErrorMessage message={errorMessage} />}
        {successMessage && <SuccessMessage message={successMessage} />}

        <form className="ds-individual__form" onSubmit={onFormSubmit}>
          <section className="ds-individual__section">
            <h2>Información del documento</h2>

            <div className="ds-individual__grid">
              <label className="ds-individual__field">
                <span>Fecha de elaboración</span>
                <input
                  type="date"
                  value={issueDate}
                  onChange={(event) => {
                    setIssueDate(event.target.value)
                    if (!isCreditPayment) setDueDate(event.target.value)
                  }}
                />
                {fieldErrors.issueDate && (
                  <em className="ds-individual__error">{fieldErrors.issueDate}</em>
                )}
              </label>

              <div className="ds-individual__field">
                <span>Número</span>
                <p className="ds-individual__readonly">
                  {nextConsecutive != null
                    ? `${resolutionPrefix} ${nextConsecutive} (Numeración automática)`
                    : `${resolutionPrefix} · Numeración automática`}
                </p>
              </div>

              <div className="ds-individual__field ds-individual__field--wide">
                <span>Proveedores</span>
                <div className="ds-individual__search">
                  <input
                    type="search"
                    placeholder="Buscar proveedor (NIT o nombre)"
                    value={supplierQuery}
                    autoComplete="off"
                    onFocus={() => setIsSupplierMenuOpen(true)}
                    onChange={(event) => {
                      setSupplierQuery(event.target.value)
                      setSelectedSupplier(null)
                      setIsSupplierMenuOpen(true)
                    }}
                    onBlur={() => {
                      if (supplierBlurTimeoutRef.current) {
                        window.clearTimeout(supplierBlurTimeoutRef.current)
                      }
                      supplierBlurTimeoutRef.current = window.setTimeout(() => {
                        setIsSupplierMenuOpen(false)
                      }, 150)
                    }}
                  />
                  {isSupplierMenuOpen && (
                    <ul className="ds-individual__supplier-list" role="listbox">
                      {isLoadingSuppliers ? (
                        <li className="ds-individual__supplier-empty">
                          Cargando proveedores...
                        </li>
                      ) : filteredSuppliers.length === 0 ? (
                        <li className="ds-individual__supplier-empty">
                          {allSuppliers.length === 0
                            ? 'No hay proveedores creados aún.'
                            : 'No hay coincidencias con esa búsqueda.'}
                        </li>
                      ) : (
                        filteredSuppliers.slice(0, 50).map((item) => (
                          <li key={item.id}>
                            <button
                              type="button"
                              className={`ds-individual__supplier-option${
                                selectedSupplier?.id === item.id
                                  ? ' is-selected'
                                  : ''
                              }`}
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => selectSupplier(item)}
                            >
                              <strong>{item.name}</strong>
                              <span>
                                {item.document_type} {item.document_number}
                                {item.check_digit ? `-${item.check_digit}` : ''}
                              </span>
                            </button>
                          </li>
                        ))
                      )}
                    </ul>
                  )}
                </div>
                {fieldErrors.supplier && (
                  <em className="ds-individual__error">{fieldErrors.supplier}</em>
                )}
                {!selectedSupplier && (
                  <p className="ds-individual__hint">
                    ¿No encuentras el proveedor?{' '}
                    <Link to="/terceros">Créalo en Terceros</Link>.
                  </p>
                )}
              </div>

              <label className="ds-individual__field">
                <span>Tipo de moneda</span>
                <select
                  value={currency}
                  onChange={(event) => setCurrency(event.target.value)}
                >
                  {currencyOptions.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="ds-individual__field">
                <span>No. comprobante proveedor</span>
                <div className="ds-individual__receipt">
                  <input
                    type="text"
                    value={documentPrefix}
                    onChange={(event) => setDocumentPrefix(event.target.value)}
                    aria-label="Prefijo"
                    maxLength={10}
                  />
                  <input
                    type="text"
                    placeholder="Consecutivo"
                    value={documentNumber}
                    onChange={(event) => setDocumentNumber(event.target.value)}
                    aria-label="Consecutivo"
                  />
                </div>
                {fieldErrors.documentNumber && (
                  <em className="ds-individual__error">
                    {fieldErrors.documentNumber}
                  </em>
                )}
              </div>

              <label className="ds-individual__field">
                <span>Forma de pago</span>
                <select
                  value={paymentFormId}
                  onChange={(event) => {
                    setPaymentFormId(event.target.value)
                    if (event.target.value !== '2') {
                      setDueDate(issueDate)
                    }
                  }}
                >
                  {paymentForms.length > 0 ? (
                    paymentForms.map((form) => (
                      <option key={form.id} value={form.id}>
                        {form.name}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="1">Contado</option>
                      <option value="2">Crédito</option>
                    </>
                  )}
                </select>
              </label>

              <label className="ds-individual__field">
                <span>Medio de pago</span>
                <select
                  value={paymentMethodId}
                  onChange={(event) => setPaymentMethodId(event.target.value)}
                >
                  <option value="">Seleccione</option>
                  {paymentMethods.map((method) => (
                    <option key={method.id} value={method.id}>
                      {method.name}
                    </option>
                  ))}
                </select>
                {fieldErrors.paymentMethod && (
                  <em className="ds-individual__error">
                    {fieldErrors.paymentMethod}
                  </em>
                )}
              </label>

              {isCreditPayment && (
                <label className="ds-individual__field">
                  <span>Fecha de vencimiento</span>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(event) => setDueDate(event.target.value)}
                  />
                  {fieldErrors.dueDate && (
                    <em className="ds-individual__error">{fieldErrors.dueDate}</em>
                  )}
                  <span className="ds-individual__hint">
                    Plazo: {daysBetween(issueDate, dueDate)} día(s)
                  </span>
                </label>
              )}

              <label className="ds-individual__field ds-individual__field--wide">
                <span>Observaciones (opcional)</span>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Notas visibles en el documento"
                />
              </label>
            </div>
          </section>

          <section className="ds-individual__section">
            <div className="ds-individual__section-head">
              <h2>Productos o servicios</h2>
              <button
                type="button"
                className="ds-individual__add-line"
                onClick={() =>
                  setLines((current) => [...current, createEmptyLine()])
                }
              >
                + Agregar línea
              </button>
            </div>

            {fieldErrors.lines && (
              <em className="ds-individual__error">{fieldErrors.lines}</em>
            )}

            <div className="ds-individual__table-wrap">
              <table className="ds-individual__table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Tipo</th>
                    <th>Código</th>
                    <th>Descripción</th>
                    <th>Cant</th>
                    <th>Valor unitario</th>
                    <th>Descuento</th>
                    <th>Impuesto cargo</th>
                    <th>%</th>
                    <th>Impuesto retención</th>
                    <th>Valor total</th>
                    <th aria-label="Eliminar" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, index) => (
                    <tr key={line.id}>
                      <td>{index + 1}</td>
                      <td>
                        <select
                          value={line.lineType}
                          onChange={(event) =>
                            updateLine(line.id, {
                              lineType: event.target.value as
                                | 'producto'
                                | 'servicio',
                            })
                          }
                        >
                          <option value="producto">Producto</option>
                          <option value="servicio">Servicio</option>
                        </select>
                      </td>
                      <td>
                        <input
                          type="text"
                          value={line.code}
                          placeholder="Código"
                          onChange={(event) =>
                            updateLine(line.id, { code: event.target.value })
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={line.description}
                          placeholder="Descripción"
                          onChange={(event) =>
                            updateLine(line.id, {
                              description: event.target.value,
                            })
                          }
                        />
                        {fieldErrors[`line-${index}-description`] && (
                          <em className="ds-individual__error">
                            {fieldErrors[`line-${index}-description`]}
                          </em>
                        )}
                      </td>
                      <td>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={line.quantity}
                          onChange={(event) =>
                            updateLine(line.id, {
                              quantity: event.target.value,
                            })
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={line.unitValue}
                          onChange={(event) =>
                            updateLine(line.id, {
                              unitValue: event.target.value,
                            })
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={line.discount}
                          onChange={(event) =>
                            updateLine(line.id, {
                              discount: event.target.value,
                            })
                          }
                        />
                      </td>
                      <td>
                        <select
                          value={line.taxChargeId}
                          onChange={(event) =>
                            updateLine(line.id, {
                              taxChargeId: event.target.value,
                              taxPercent: event.target.value
                                ? line.taxPercent || String(DEFAULT_IVA_PERCENT)
                                : '0',
                            })
                          }
                        >
                          <option value="">Sin impuesto</option>
                          {chargeTaxes.map((tax) => (
                            <option key={tax.id} value={tax.id}>
                              {tax.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={line.taxPercent}
                          disabled={!line.taxChargeId}
                          onChange={(event) =>
                            updateLine(line.id, {
                              taxPercent: event.target.value,
                            })
                          }
                        />
                      </td>
                      <td>
                        <select
                          value={line.taxRetentionId}
                          onChange={(event) =>
                            updateLine(line.id, {
                              taxRetentionId: event.target.value,
                            })
                          }
                        >
                          <option value="">Sin retención</option>
                          {retentionTaxes.map((tax) => (
                            <option key={tax.id} value={tax.id}>
                              {tax.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="ds-individual__total-cell">
                        {formatMoney(lineTotal(line))}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="ds-individual__delete"
                          aria-label="Eliminar línea"
                          disabled={lines.length <= 1}
                          onClick={() => removeLine(line.id)}
                        >
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                          >
                            <path
                              d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"
                              strokeWidth="1.6"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="ds-individual__totals">
              <div>
                <span>Subtotal</span>
                <strong>{formatMoney(documentSubtotal)}</strong>
              </div>
              <div>
                <span>Impuestos</span>
                <strong>{formatMoney(documentTax)}</strong>
              </div>
              <div className="ds-individual__totals-payable">
                <span>Total a pagar</span>
                <strong>{formatMoney(documentTotal)}</strong>
              </div>
            </div>
          </section>

          <footer className="ds-individual__actions">
            <button
              type="button"
              className="ds-individual__btn ds-individual__btn--ghost"
              disabled={isSubmitting}
              onClick={() => void handleSubmit('save')}
            >
              {isSubmitting && submitMode === 'save'
                ? 'Guardando...'
                : 'Guardar'}
            </button>
            <button
              type="button"
              className="ds-individual__btn ds-individual__btn--outline"
              disabled={isSubmitting}
              onClick={() => void handleSubmit('save-new')}
            >
              {isSubmitting && submitMode === 'save-new'
                ? 'Guardando...'
                : 'Guardar y nuevo'}
            </button>
            <button
              type="submit"
              className="ds-individual__btn ds-individual__btn--primary"
              disabled={isSubmitting}
            >
              {isSubmitting && submitMode === 'send'
                ? 'Enviando...'
                : 'Guardar y enviar'}
            </button>
          </footer>
        </form>
      </div>
    </section>
  )
}

export default SupportDocumentIndividualPage
