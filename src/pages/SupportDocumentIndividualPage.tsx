import {
  type FormEvent,
  useCallback,
  useEffect,
  useId,
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

interface LineItem {
  id: string
  description: string
  quantity: string
  unitValue: string
  discount: string
  taxChargeId: string
  taxRetentionId: string
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
    description: '',
    quantity: '1',
    unitValue: '0',
    discount: '0',
    taxChargeId: '',
    taxRetentionId: '',
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

function lineTaxAmount(
  line: LineItem,
  taxesById: Map<number, JarvisCatalogItem>,
): number {
  const taxId = Number(line.taxChargeId)
  if (!Number.isFinite(taxId) || taxId <= 0) return 0
  const tax = taxesById.get(taxId)
  if (!isIvaTax(tax)) return 0
  const percent = tax?.percentage && tax.percentage > 0
    ? tax.percentage
    : DEFAULT_IVA_PERCENT
  return Math.round((lineBaseTotal(line) * percent + Number.EPSILON) * 100) / 100
}

function lineTotal(
  line: LineItem,
  taxesById: Map<number, JarvisCatalogItem>,
): number {
  return lineBaseTotal(line) + lineTaxAmount(line, taxesById)
}

type SubmitMode = 'save' | 'save-new' | 'send'

function SupportDocumentIndividualPage() {
  const navigate = useNavigate()
  const supplierListId = useId()
  const [issueDate, setIssueDate] = useState(todayLocalDate)
  const [documentPrefix, setDocumentPrefix] = useState('DS')
  const [documentNumber, setDocumentNumber] = useState('')
  const [supplierQuery, setSupplierQuery] = useState('')
  const [selectedSupplier, setSelectedSupplier] = useState<JarvisTercero | null>(
    null,
  )
  const [supplierResults, setSupplierResults] = useState<JarvisTercero[]>([])
  const [lines, setLines] = useState<LineItem[]>([createEmptyLine()])
  const [taxes, setTaxes] = useState<JarvisCatalogItem[]>([])
  const [paymentMethods, setPaymentMethods] = useState<JarvisCatalogItem[]>([])
  const [paymentMethodId, setPaymentMethodId] = useState('')
  const [nextConsecutive, setNextConsecutive] = useState<number | null>(null)
  const [resolutionPrefix, setResolutionPrefix] = useState('DS')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitMode, setSubmitMode] = useState<SubmitMode | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const searchTimeoutRef = useRef<number | null>(null)

  const taxesById = new Map(taxes.map((tax) => [tax.id, tax]))
  const chargeTaxes = taxes.filter((tax) => !isRetentionTax(tax))
  const retentionTaxes = taxes.filter((tax) => isRetentionTax(tax))

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
        if (catalogs.paymentMethods?.[0]) {
          setPaymentMethodId(String(catalogs.paymentMethods[0].id))
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

  useEffect(() => {
    if (searchTimeoutRef.current) {
      window.clearTimeout(searchTimeoutRef.current)
    }

    const query = supplierQuery.trim()
    if (query.length < 2) {
      setSupplierResults([])
      return
    }

    if (
      selectedSupplier &&
      (selectedSupplier.name === query ||
        selectedSupplier.document_number === query ||
        `${selectedSupplier.document_number} — ${selectedSupplier.name}` ===
          query)
    ) {
      return
    }

    searchTimeoutRef.current = window.setTimeout(() => {
      void fetchJarvisTerceros(query)
        .then((response) => {
          setSupplierResults(response.items ?? [])
        })
        .catch(() => {
          setSupplierResults([])
        })
    }, 300)

    return () => {
      if (searchTimeoutRef.current) {
        window.clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [supplierQuery, selectedSupplier])

  const resetForm = useCallback(() => {
    setIssueDate(todayLocalDate())
    setDocumentNumber('')
    setSupplierQuery('')
    setSelectedSupplier(null)
    setSupplierResults([])
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
    setSupplierResults([])
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
  }, [documentNumber, issueDate, lines, selectedSupplier])

  const buildRequest = useCallback(
    (send: boolean) => {
      if (!selectedSupplier) {
        throw new Error('Debe seleccionar un proveedor.')
      }

        const taxesLookup = new Map(taxes.map((tax) => [tax.id, tax]))
      const retentions = lines
        .map((line) => {
          const retentionId = Number(line.taxRetentionId)
          if (!Number.isFinite(retentionId) || retentionId <= 0) return null
          const tax = taxesLookup.get(retentionId)
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

      return {
        issueDate: issueDate.trim(),
        supplierDocumentType: selectedSupplier.document_type,
        supplierIdentification: selectedSupplier.document_number,
        supplierName: selectedSupplier.name,
        documentPrefix: documentPrefix.trim() || 'DS',
        documentNumber: documentNumber.trim(),
        items: lines
          .filter((line) => line.description.trim())
          .map((line) => ({
            description: line.description.trim(),
            quantity: parseAmount(line.quantity),
            unitValue: parseAmount(line.unitValue),
            discount: parseAmount(line.discount),
            taxAmount: lineTaxAmount(line, taxesLookup),
          })),
        ...(uniqueRetentions.length > 0
          ? { retentions: uniqueRetentions }
          : {}),
        ...(Number.isFinite(paymentId) && paymentId > 0
          ? {
              payment: {
                id: paymentId,
                payment_form_id: 1,
                due_date: issueDate.trim(),
              },
            }
          : {}),
        send,
      }
    },
    [
      documentNumber,
      documentPrefix,
      issueDate,
      lines,
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
      <header className="ds-individual__header">
        <div>
          <p className="ds-individual__breadcrumb">
            <Link to="/documento-soporte">Documento Soporte</Link>
            <span aria-hidden="true"> › </span>
            <span>Nuevo documento</span>
          </p>
          <h1>Nuevo documento soporte</h1>
          <p>Crea tu documento soporte de forma rápida y sencilla.</p>
        </div>
      </header>

      {errorMessage && <ErrorMessage message={errorMessage} />}
      {successMessage && <SuccessMessage message={successMessage} />}

      <form className="ds-individual__form" onSubmit={onFormSubmit}>
        <section className="ds-individual__card">
          <h2>Información del documento</h2>

          <div className="ds-individual__grid">
            <label className="ds-individual__field">
              <span>Tipo</span>
              <select disabled value="DS">
                <option value="DS">
                  {resolutionPrefix} - Documento soporte
                </option>
              </select>
            </label>

            <label className="ds-individual__field">
              <span>Fecha de elaboración</span>
              <input
                type="date"
                value={issueDate}
                onChange={(event) => setIssueDate(event.target.value)}
              />
              {fieldErrors.issueDate && (
                <em className="ds-individual__error">{fieldErrors.issueDate}</em>
              )}
            </label>

            <label className="ds-individual__field ds-individual__field--wide">
              <span>Proveedores</span>
              <div className="ds-individual__search">
                <input
                  type="search"
                  list={supplierListId}
                  placeholder="Buscar proveedor (NIT o nombre)"
                  value={supplierQuery}
                  onChange={(event) => {
                    setSupplierQuery(event.target.value)
                    setSelectedSupplier(null)
                  }}
                  onBlur={() => {
                    const match = supplierResults.find(
                      (item) =>
                        item.document_number === supplierQuery.trim() ||
                        `${item.document_number} — ${item.name}` ===
                          supplierQuery.trim(),
                    )
                    if (match) selectSupplier(match)
                  }}
                />
                <datalist id={supplierListId}>
                  {supplierResults.map((item) => (
                    <option
                      key={item.id}
                      value={`${item.document_number} — ${item.name}`}
                    />
                  ))}
                </datalist>
              </div>
              {fieldErrors.supplier && (
                <em className="ds-individual__error">{fieldErrors.supplier}</em>
              )}
              {!selectedSupplier && supplierQuery.trim().length >= 2 && (
                <p className="ds-individual__hint">
                  ¿No encuentras el proveedor?{' '}
                  <Link to="/terceros">Créalo en Terceros</Link>.
                </p>
              )}
            </label>

            <div className="ds-individual__field">
              <span>Número</span>
              <p className="ds-individual__readonly">
                {nextConsecutive != null
                  ? `${nextConsecutive} (Numeración automática)`
                  : 'Numeración automática'}
              </p>
            </div>

            <div className="ds-individual__field ds-individual__field--receipt">
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

            {paymentMethods.length > 0 && (
              <label className="ds-individual__field">
                <span>Medio de pago</span>
                <select
                  value={paymentMethodId}
                  onChange={(event) => setPaymentMethodId(event.target.value)}
                >
                  {paymentMethods.map((method) => (
                    <option key={method.id} value={method.id}>
                      {method.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </section>

        <section className="ds-individual__card">
          <div className="ds-individual__section-head">
            <h2>Productos o servicios</h2>
            <button
              type="button"
              className="ds-individual__add-line"
              onClick={() => setLines((current) => [...current, createEmptyLine()])}
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
                  <th>Descripción</th>
                  <th>Cant</th>
                  <th>Valor unitario</th>
                  <th>Descuento</th>
                  <th>Impuesto cargo</th>
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
                          updateLine(line.id, { quantity: event.target.value })
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={line.unitValue}
                        onChange={(event) =>
                          updateLine(line.id, { unitValue: event.target.value })
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={line.discount}
                        onChange={(event) =>
                          updateLine(line.id, { discount: event.target.value })
                        }
                      />
                    </td>
                    <td>
                      <select
                        value={line.taxChargeId}
                        onChange={(event) =>
                          updateLine(line.id, {
                            taxChargeId: event.target.value,
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
                      {formatMoney(lineTotal(line, taxesById))}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="ds-individual__delete"
                        aria-label="Eliminar línea"
                        disabled={lines.length <= 1}
                        onClick={() => removeLine(line.id)}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
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
        </section>

        <footer className="ds-individual__actions">
          <button
            type="button"
            className="ds-individual__btn ds-individual__btn--ghost"
            disabled={isSubmitting}
            onClick={() => void handleSubmit('save')}
          >
            {isSubmitting && submitMode === 'save' ? 'Guardando...' : 'Guardar'}
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
    </section>
  )
}

export default SupportDocumentIndividualPage
