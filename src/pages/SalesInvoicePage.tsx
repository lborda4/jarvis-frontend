import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import CreateJarvisTerceroModal from '../components/CreateJarvisTerceroModal'
import DatePicker from '../components/DatePicker'
import ErrorMessage from '../components/ErrorMessage'
import SuccessMessage from '../components/SuccessMessage'
import { getApiErrorMessage } from '../services/apiClient'
import {
  createJarvisInvoice,
  fetchJarvisCatalogs,
  fetchJarvisCredentialsStatus,
  fetchJarvisTerceros,
  type JarvisCatalogItem,
} from '../services/jarvisService'
import type { JarvisTercero } from '../types/jarvis'
import {
  addDaysToLocalDate,
  daysBetweenLocalDates,
} from '../utils/supportDocumentDate'
import './SupportDocumentIndividualPage.css'

const DEFAULT_IVA_PERCENT = 19

function todayLocalDate(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

interface LineItem {
  id: string
  code: string
  description: string
  quantity: string
  unitValue: string
  discount: string
  taxChargeId: string
  taxPercent: string
}

function createEmptyLine(): LineItem {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    code: '',
    description: '',
    quantity: '1',
    unitValue: '0',
    discount: '0',
    taxChargeId: '',
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

function SalesInvoicePage() {
  const [issueDate, setIssueDate] = useState(todayLocalDate)
  const [dueDate, setDueDate] = useState(todayLocalDate)
  const [notes, setNotes] = useState('')
  const [headNote, setHeadNote] = useState('')
  const [footNote, setFootNote] = useState('')
  const [discountAmount, setDiscountAmount] = useState('0')
  const [customerQuery, setCustomerQuery] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<JarvisTercero | null>(
    null,
  )
  const [allCustomers, setAllCustomers] = useState<JarvisTercero[]>([])
  const [isCustomerMenuOpen, setIsCustomerMenuOpen] = useState(false)
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false)
  const [isCreateCustomerOpen, setIsCreateCustomerOpen] = useState(false)
  const [lines, setLines] = useState<LineItem[]>([createEmptyLine()])
  const [taxes, setTaxes] = useState<JarvisCatalogItem[]>([])
  const [paymentMethods, setPaymentMethods] = useState<JarvisCatalogItem[]>([])
  const [paymentForms, setPaymentForms] = useState<JarvisCatalogItem[]>([])
  const [paymentMethodId, setPaymentMethodId] = useState('')
  const [paymentFormId, setPaymentFormId] = useState('1')
  const [nextConsecutive, setNextConsecutive] = useState<number | null>(null)
  const [resolutionPrefix, setResolutionPrefix] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const customerBlurTimeoutRef = useRef<number | null>(null)

  const chargeTaxes = taxes.filter((tax) => !isRetentionTax(tax))
  const retentionTaxes = taxes.filter(isRetentionTax)
  const isCreditPayment = paymentFormId === '2'
  const plazoDays = Math.max(0, daysBetweenLocalDates(issueDate, dueDate))
  const documentSubtotal = lines.reduce((sum, line) => sum + lineBaseTotal(line), 0)
  const documentTax = lines.reduce((sum, line) => sum + lineTaxAmount(line), 0)
  const discount = Math.max(0, parseAmount(discountAmount))
  const documentTotal = documentSubtotal - discount + documentTax

  const filteredCustomers = (() => {
    const query = customerQuery.trim().toLowerCase()
    if (!query) return allCustomers

    if (
      selectedCustomer &&
      `${selectedCustomer.document_number} — ${selectedCustomer.name}`.toLowerCase() ===
        query
    ) {
      return [selectedCustomer]
    }

    return allCustomers.filter((item) => {
      const name = item.name.toLowerCase()
      const documentNumber = item.document_number.toLowerCase()
      return name.includes(query) || documentNumber.includes(query)
    })
  })()

  useEffect(() => {
    let cancelled = false

    async function loadCustomers() {
      setIsLoadingCustomers(true)
      try {
        const response = await fetchJarvisTerceros()
        if (!cancelled) {
          setAllCustomers(response.items ?? [])
        }
      } catch {
        if (!cancelled) {
          setAllCustomers([])
        }
      } finally {
        if (!cancelled) {
          setIsLoadingCustomers(false)
        }
      }
    }

    void loadCustomers()

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
        if (catalogs.paymentMethods?.[0]) {
          setPaymentMethodId(String(catalogs.paymentMethods[0].id))
        }
        if (catalogs.paymentForms?.[0]) {
          setPaymentFormId(String(catalogs.paymentForms[0].id))
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

        const resolution = status.electronicInvoiceResolution
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
              'No se pudieron cargar los catálogos de factura de venta.',
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
    setNotes('')
    setHeadNote('')
    setFootNote('')
    setDiscountAmount('0')
    setCustomerQuery('')
    setSelectedCustomer(null)
    setIsCustomerMenuOpen(false)
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

  const selectCustomer = useCallback((tercero: JarvisTercero) => {
    setSelectedCustomer(tercero)
    setCustomerQuery(`${tercero.document_number} — ${tercero.name}`)
    setIsCustomerMenuOpen(false)
    setFieldErrors((current) => {
      const next = { ...current }
      delete next.customer
      return next
    })
  }, [])

  const validate = useCallback((): boolean => {
    const nextErrors: Record<string, string> = {}

    if (!selectedCustomer) {
      nextErrors.customer = 'Debe seleccionar un cliente.'
    }

    if (!issueDate.trim()) {
      nextErrors.issueDate = 'La fecha es obligatoria.'
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
  }, [dueDate, isCreditPayment, issueDate, lines, paymentMethodId, selectedCustomer])

  const handleSubmit = useCallback(async () => {
    setErrorMessage(null)
    setSuccessMessage(null)

    if (!validate() || !selectedCustomer) {
      setErrorMessage('Revisa los campos marcados antes de continuar.')
      return
    }

    setIsSubmitting(true)

    try {
      const taxesById = new Map(taxes.map((tax) => [tax.id, tax]))
      const retentions = lines
        .map((line) => {
          const retentionId = Number(line.taxChargeId)
          if (!retentionTaxes.some((tax) => tax.id === retentionId)) return null
          const tax = taxesById.get(retentionId)
          return tax
            ? { id: tax.id, type: tax.type ?? tax.name, percentage: tax.percentage ?? undefined }
            : null
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

      const response = await createJarvisInvoice({
        issueDate: issueDate.trim(),
        customerDocumentType: selectedCustomer.document_type,
        customerIdentification: selectedCustomer.document_number,
        customerName: selectedCustomer.name,
        ...(notes.trim() ? { observations: notes.trim() } : {}),
        ...(headNote.trim() ? { headNote: headNote.trim() } : {}),
        ...(footNote.trim() ? { footNote: footNote.trim() } : {}),
        ...(discount > 0 ? { discountAmount: discount } : {}),
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
        ...(uniqueRetentions.length > 0 ? { retentions: uniqueRetentions } : {}),
        ...(Number.isFinite(paymentId) && paymentId > 0
          ? {
              payment: {
                id: paymentId,
                payment_form_id: Number.isFinite(formId) ? formId : 1,
                due_date: paymentDueDate,
              },
            }
          : {}),
      })

      const consecutive = response.invoice?.consecutive || response.invoice?.number
      setSuccessMessage(
        consecutive
          ? `Factura de venta ${response.invoice?.prefix ?? ''} ${consecutive} enviada a DIAN.`
          : 'Factura de venta enviada a DIAN.',
      )
      if (typeof consecutive === 'number' && nextConsecutive != null) {
        setNextConsecutive(consecutive + 1)
      }
      resetForm()
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(error, 'No se pudo enviar la factura de venta.'),
      )
    } finally {
      setIsSubmitting(false)
    }
  }, [
    discount,
    dueDate,
    footNote,
    headNote,
    isCreditPayment,
    issueDate,
    lines,
    nextConsecutive,
    notes,
    paymentFormId,
    paymentMethodId,
    resetForm,
    retentionTaxes,
    selectedCustomer,
    taxes,
    validate,
  ])

  const onFormSubmit = (event: FormEvent) => {
    event.preventDefault()
    void handleSubmit()
  }

  return (
    <section className="ds-individual">
      <p className="ds-individual__breadcrumb">
        <Link to="/inicio">Jarvis</Link>
        <span aria-hidden="true"> › </span>
        <span>Factura de venta</span>
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
              <h1>Nueva factura de venta</h1>
              <p>Emite y envía tu factura electrónica de venta a la DIAN.</p>
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
                <span>Fecha de expedición</span>
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
                  {resolutionPrefix
                    ? nextConsecutive != null
                      ? `${resolutionPrefix} ${nextConsecutive} (Numeración automática)`
                      : `${resolutionPrefix} · Numeración automática`
                    : 'Configure la resolución de factura electrónica'}
                </p>
              </div>

              <div className="ds-individual__field ds-individual__field--wide">
                <span>Cliente</span>
                <div className="ds-individual__search">
                  <input
                    type="search"
                    placeholder="Buscar cliente (NIT o nombre)"
                    value={customerQuery}
                    autoComplete="off"
                    onFocus={() => setIsCustomerMenuOpen(true)}
                    onChange={(event) => {
                      setCustomerQuery(event.target.value)
                      setSelectedCustomer(null)
                      setIsCustomerMenuOpen(true)
                    }}
                    onBlur={() => {
                      if (customerBlurTimeoutRef.current) {
                        window.clearTimeout(customerBlurTimeoutRef.current)
                      }
                      customerBlurTimeoutRef.current = window.setTimeout(() => {
                        setIsCustomerMenuOpen(false)
                      }, 150)
                    }}
                  />
                  {isCustomerMenuOpen && (
                    <ul className="ds-individual__supplier-list" role="listbox">
                      {isLoadingCustomers ? (
                        <li className="ds-individual__supplier-empty">
                          Cargando clientes...
                        </li>
                      ) : filteredCustomers.length === 0 ? (
                        <li className="ds-individual__supplier-empty">
                          {allCustomers.length === 0
                            ? 'No hay clientes creados aún.'
                            : 'No hay coincidencias con esa búsqueda.'}
                        </li>
                      ) : (
                        filteredCustomers.slice(0, 50).map((item) => (
                          <li key={item.id}>
                            <button
                              type="button"
                              className={`ds-individual__supplier-option${
                                selectedCustomer?.id === item.id
                                  ? ' is-selected'
                                  : ''
                              }`}
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => selectCustomer(item)}
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
                {fieldErrors.customer && (
                  <em className="ds-individual__error">{fieldErrors.customer}</em>
                )}
                {!selectedCustomer && (
                  <p className="ds-individual__hint">
                    ¿No encuentras el cliente?{' '}
                    <button
                      type="button"
                      onClick={() => setIsCreateCustomerOpen(true)}
                    >
                      Créalo aquí
                    </button>
                    , sin perder lo que ya llevas en esta factura.
                  </p>
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

              <div className="ds-individual__field">
                <span>Plazo</span>
                <div
                  className={`ds-individual__term${
                    isCreditPayment ? '' : ' ds-individual__term--disabled'
                  }`}
                >
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={isCreditPayment ? plazoDays : ''}
                    onChange={(event) => {
                      const raw = event.target.value
                      const days = raw === '' ? 0 : Math.max(0, Number(raw))
                      setDueDate(addDaysToLocalDate(issueDate, days))
                    }}
                    disabled={!isCreditPayment}
                    placeholder="0"
                  />
                  <span className="ds-individual__term-suffix">días</span>
                </div>
              </div>

              <label className="ds-individual__field">
                <span>Fecha de vencimiento</span>
                <DatePicker
                  value={dueDate}
                  onChange={setDueDate}
                  disabled={!isCreditPayment}
                  minDate={issueDate}
                />
                {fieldErrors.dueDate && (
                  <em className="ds-individual__error">{fieldErrors.dueDate}</em>
                )}
              </label>

              <label className="ds-individual__field">
                <span>Descuento general (opcional)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={discountAmount}
                  onChange={(event) => setDiscountAmount(event.target.value)}
                />
              </label>

              <label className="ds-individual__field ds-individual__field--wide">
                <span>Observaciones (opcional)</span>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Notas visibles en el documento"
                />
              </label>

              <label className="ds-individual__field ds-individual__field--wide">
                <span>Texto de encabezado (opcional)</span>
                <textarea
                  rows={2}
                  value={headNote}
                  onChange={(event) => setHeadNote(event.target.value)}
                  placeholder="Texto libre para el encabezado de la representación gráfica"
                />
              </label>

              <label className="ds-individual__field ds-individual__field--wide">
                <span>Texto de pie de página (opcional)</span>
                <textarea
                  rows={2}
                  value={footNote}
                  onChange={(event) => setFootNote(event.target.value)}
                  placeholder="Texto libre para el pie de página de la representación gráfica"
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
                    <th>Código</th>
                    <th>Descripción</th>
                    <th>Cant</th>
                    <th>Valor unitario</th>
                    <th>Descuento</th>
                    <th>Impuesto</th>
                    <th>%</th>
                    <th>Valor total</th>
                    <th aria-label="Eliminar" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, index) => (
                    <tr key={line.id}>
                      <td>{index + 1}</td>
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
              {discount > 0 && (
                <div>
                  <span>Descuento</span>
                  <strong>-{formatMoney(discount)}</strong>
                </div>
              )}
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
              type="submit"
              className="ds-individual__btn ds-individual__btn--primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Enviando...' : 'Enviar a DIAN'}
            </button>
          </footer>
        </form>
      </div>

      <CreateJarvisTerceroModal
        isOpen={isCreateCustomerOpen}
        onClose={() => setIsCreateCustomerOpen(false)}
        initialDocumentNumber={customerQuery}
        onCreated={(tercero) => {
          setAllCustomers((current) => [tercero, ...current])
          selectCustomer(tercero)
          setIsCreateCustomerOpen(false)
        }}
      />
    </section>
  )
}

export default SalesInvoicePage
