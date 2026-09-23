import {
  type DragEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { Link, useNavigate } from 'react-router-dom'
import CreateJarvisTerceroModal from '../components/CreateJarvisTerceroModal'
import DatePicker from '../components/DatePicker'
import ErrorMessage from '../components/ErrorMessage'
import JarvisProductSearch from '../components/JarvisProductSearch'
import SuccessMessage from '../components/SuccessMessage'
import { getApiErrorMessage } from '../services/apiClient'
import {
  createJarvisInvoice,
  fetchJarvisCatalogs,
  fetchJarvisCredentialsStatus,
  fetchJarvisTerceros,
  type JarvisCatalogItem,
} from '../services/jarvisService'
import { fetchProducts, type ProductResponse } from '../services/productService'
import type { JarvisTercero } from '../types/jarvis'
import {
  addDaysToLocalDate,
  daysBetweenLocalDates,
} from '../utils/supportDocumentDate'
import './SupportDocumentIndividualPage.css'

const DEFAULT_IVA_PERCENT = 19

const COMMON_CURRENCY_CODES = [
  'COP', 'USD', 'EUR', 'GBP', 'MXN', 'BRL', 'ARS', 'CLP', 'PEN', 'CAD', 'CHF', 'JPY', 'CNY', 'AUD',
] as const

const CURRENCY_LABELS: Record<string, string> = {
  COP: 'Peso colombiano', USD: 'Dólar estadounidense', EUR: 'Euro', GBP: 'Libra esterlina',
  MXN: 'Peso mexicano', BRL: 'Real brasileño', ARS: 'Peso argentino', CLP: 'Peso chileno',
  PEN: 'Sol peruano', CAD: 'Dólar canadiense', CHF: 'Franco suizo',
  JPY: 'Yen japonés', CNY: 'Yuan chino', AUD: 'Dólar australiano',
}

interface LineItem {
  id: string
  productSearch: string
  code?: string
  description: string
  quantity: string
  unitValue: string
  discount: string
  taxChargeId: string
  taxRetentionId: string
  taxPercent: string
}

interface PaymentEntry {
  id: string
  methodId: string
  amount: string
}

function resolveProductPrice(product: ProductResponse): number | null {
  const lists = [...(product.priceLists ?? [])].sort((a, b) => a.position - b.position)
  if (lists.length === 0) return null
  const firstEnabled = lists.find((list) => list.enabled)
  return (firstEnabled ?? lists[0]).price
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
    productSearch: '',
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

function createEmptyPayment(): PaymentEntry {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    methodId: '',
    amount: '0.00',
  }
}

function parseAmount(value: string): number {
  const normalized = value.replace(/\s/g, '').replace(',', '.')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatMoney(value: number): string {
  return value.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function isRetentionTax(tax: JarvisCatalogItem): boolean {
  const label = `${tax.name ?? ''} ${tax.type ?? ''}`.toUpperCase()
  return label.includes('RETE') || label.includes('RETENC') || label.includes('RENTA') || label.includes('ICA')
}

function isIvaTax(tax: JarvisCatalogItem | undefined): boolean {
  if (!tax) return false
  const label = `${tax.name ?? ''} ${tax.code ?? ''}`.toUpperCase()
  return label.includes('IVA') && !label.includes('RETE')
}

function lineGross(line: LineItem): number {
  return Math.max(0, parseAmount(line.quantity)) * Math.max(0, parseAmount(line.unitValue))
}

function lineDiscountAmount(line: LineItem, discountIsPercent: boolean): number {
  const gross = lineGross(line)
  const raw = Math.max(0, parseAmount(line.discount))
  return discountIsPercent ? (gross * raw) / 100 : raw
}

function lineBaseTotal(line: LineItem, discountIsPercent: boolean): number {
  return Math.max(0, lineGross(line) - lineDiscountAmount(line, discountIsPercent))
}

function lineTaxAmount(line: LineItem, discountIsPercent: boolean): number {
  const taxId = Number(line.taxChargeId)
  if (!Number.isFinite(taxId) || taxId <= 0) return 0
  const percent = Math.max(0, parseAmount(line.taxPercent) || DEFAULT_IVA_PERCENT)
  return Math.round((lineBaseTotal(line, discountIsPercent) * percent) / 100 * 100) / 100
}

function lineTotal(line: LineItem, discountIsPercent: boolean): number {
  return lineBaseTotal(line, discountIsPercent) + lineTaxAmount(line, discountIsPercent)
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

type SubmitMode = 'save' | 'send'

function SalesInvoicePage() {
  const navigate = useNavigate()
  const [issueDate, setIssueDate] = useState(todayLocalDate)
  const [dueDate, setDueDate] = useState(todayLocalDate)
  const [currency, setCurrency] = useState('COP')
  const [notes, setNotes] = useState('')
  const [headNote, setHeadNote] = useState('')
  const [footNote, setFootNote] = useState('')
  const [discountIsPercent, setDiscountIsPercent] = useState(false)

  const [customerQuery, setCustomerQuery] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<JarvisTercero | null>(null)
  const [allCustomers, setAllCustomers] = useState<JarvisTercero[]>([])
  const [isCustomerMenuOpen, setIsCustomerMenuOpen] = useState(false)
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false)
  const [isCreateCustomerOpen, setIsCreateCustomerOpen] = useState(false)
  const customerBlurTimeoutRef = useRef<number | null>(null)

  const [allProducts, setAllProducts] = useState<ProductResponse[]>([])
  const [isLoadingProducts, setIsLoadingProducts] = useState(false)
  const [lines, setLines] = useState<LineItem[]>([createEmptyLine()])
  const [taxes, setTaxes] = useState<JarvisCatalogItem[]>([])
  const [paymentMethods, setPaymentMethods] = useState<JarvisCatalogItem[]>([])
  const [paymentForms, setPaymentForms] = useState<JarvisCatalogItem[]>([])
  const [currencies, setCurrencies] = useState<JarvisCatalogItem[]>([])

  const [paymentFormId, setPaymentFormId] = useState('1')
  const [payments, setPayments] = useState<PaymentEntry[]>([createEmptyPayment()])
  const [reteIcaId, setReteIcaId] = useState('')

  const [nextConsecutive, setNextConsecutive] = useState<number | null>(null)
  const [resolutionPrefix, setResolutionPrefix] = useState('')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitMode, setSubmitMode] = useState<SubmitMode | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const [attachedFile, setAttachedFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const chargeTaxes = taxes.filter((tax) => !isRetentionTax(tax))
  const retentionTaxes = taxes.filter((tax) => isRetentionTax(tax))

  const isCreditPayment = (() => {
    if (paymentForms.length > 0) {
      const form = paymentForms.find((f) => String(f.id) === paymentFormId)
      return form?.name?.toLowerCase().includes('cr') ?? paymentFormId === '2'
    }
    return paymentFormId === '2'
  })()

  const plazoDays = Math.max(0, daysBetweenLocalDates(issueDate, dueDate))

  const currencyOptions = (() => {
    const matched = COMMON_CURRENCY_CODES.map((code) => {
      const master = currencies.find((item) => (item.code ?? '').trim().toUpperCase() === code)
      return { code, id: master?.id ?? null, label: `${code} - ${CURRENCY_LABELS[code] ?? master?.name ?? code}`, available: Boolean(master) }
    }).filter((o) => o.available)
    if (matched.length > 0) return matched
    if (currencies.length > 0) return currencies.slice(0, 20).map((item) => {
      const code = (item.code ?? item.name ?? String(item.id)).toUpperCase()
      return { code, id: item.id, label: item.code ? `${item.code} - ${item.name}` : item.name || code, available: true }
    })
    return [{ code: 'COP', id: null as number | null, label: 'COP - Peso colombiano', available: false }]
  })()

  const documentGross = lines.reduce((sum, line) => sum + lineGross(line), 0)
  const documentDiscounts = lines.reduce((sum, line) => sum + lineDiscountAmount(line, discountIsPercent), 0)
  const documentSubtotal = lines.reduce((sum, line) => sum + lineBaseTotal(line, discountIsPercent), 0)
  const documentTax = lines.reduce((sum, line) => sum + lineTaxAmount(line, discountIsPercent), 0)
  const reteIcaTax = (() => {
    if (!reteIcaId) return 0
    const tax = taxes.find((t) => String(t.id) === reteIcaId)
    const rate = tax?.percentage ?? 0
    return Math.round((documentSubtotal * rate) / 100 * 100) / 100
  })()
  const documentTotal = documentSubtotal + documentTax - reteIcaTax

  const filteredCustomers = (() => {
    const query = customerQuery.trim().toLowerCase()
    if (!query) return allCustomers
    if (selectedCustomer && `${selectedCustomer.document_number} — ${selectedCustomer.name}`.toLowerCase() === query) return [selectedCustomer]
    return allCustomers.filter((item) => item.name.toLowerCase().includes(query) || item.document_number.toLowerCase().includes(query))
  })()

  useEffect(() => {
    let cancelled = false
    async function loadCustomers() {
      setIsLoadingCustomers(true)
      try {
        const response = await fetchJarvisTerceros()
        if (!cancelled) setAllCustomers(response.items ?? [])
      } catch { if (!cancelled) setAllCustomers([]) }
      finally { if (!cancelled) setIsLoadingCustomers(false) }
    }
    void loadCustomers()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function loadProducts() {
      setIsLoadingProducts(true)
      try {
        const response = await fetchProducts()
        if (!cancelled) setAllProducts(response.items ?? [])
      } catch {
        if (!cancelled) setAllProducts([])
      } finally {
        if (!cancelled) setIsLoadingProducts(false)
      }
    }
    void loadProducts()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function loadCatalogs() {
      try {
        const [catalogs, status] = await Promise.all([fetchJarvisCatalogs(), fetchJarvisCredentialsStatus()])
        if (cancelled) return
        setTaxes(catalogs.taxes ?? [])
        setPaymentMethods(catalogs.paymentMethods ?? [])
        setPaymentForms(catalogs.paymentForms ?? [])
        setCurrencies(catalogs.currencies ?? [])
        if (catalogs.paymentForms?.[0]) setPaymentFormId(String(catalogs.paymentForms[0].id))
        if (catalogs.paymentMethods?.[0]) setPayments([{ ...createEmptyPayment(), methodId: String(catalogs.paymentMethods[0].id) }])
        const hasCop = (catalogs.currencies ?? []).some((item) => (item.code ?? '').trim().toUpperCase() === 'COP')
        if (!hasCop) { const fc = catalogs.currencies?.[0]?.code?.trim(); if (fc) setCurrency(fc.toUpperCase()) }
        const ivaDefault = (catalogs.taxes ?? []).find((tax) => isIvaTax(tax))
        if (ivaDefault) setLines((current) => current.map((line) => line.taxChargeId ? line : { ...line, taxChargeId: String(ivaDefault.id), taxPercent: String(DEFAULT_IVA_PERCENT) }))
        const resolution = status.electronicInvoiceResolution
        if (resolution?.nextConsecutive != null) setNextConsecutive(resolution.nextConsecutive)
        if (resolution?.prefix?.trim()) setResolutionPrefix(resolution.prefix.trim())
      } catch (error) {
        if (!cancelled) setErrorMessage(getApiErrorMessage(error, 'No se pudieron cargar los catálogos de factura de venta.'))
      }
    }
    void loadCatalogs()
    return () => { cancelled = true }
  }, [])

  const resetForm = useCallback(() => {
    setIssueDate(todayLocalDate())
    setDueDate(todayLocalDate())
    setNotes('')
    setHeadNote('')
    setFootNote('')
    setCustomerQuery('')
    setSelectedCustomer(null)
    setIsCustomerMenuOpen(false)
    setLines([createEmptyLine()])
    setPayments([createEmptyPayment()])
    setReteIcaId('')
    setDiscountIsPercent(false)
    setAttachedFile(null)
    setFieldErrors({})
    setErrorMessage(null)
  }, [])

  const updateLine = useCallback((lineId: string, patch: Partial<LineItem>) => {
    setLines((current) => current.map((line) => (line.id === lineId ? { ...line, ...patch } : line)))
  }, [])

  const removeLine = useCallback((lineId: string) => {
    setLines((current) => { if (current.length <= 1) return current; return current.filter((line) => line.id !== lineId) })
  }, [])

  const selectCustomer = useCallback((tercero: JarvisTercero) => {
    setSelectedCustomer(tercero)
    setCustomerQuery(`${tercero.document_number} — ${tercero.name}`)
    setIsCustomerMenuOpen(false)
    setFieldErrors((current) => { const next = { ...current }; delete next.customer; return next })
  }, [])

  const handleSelectProduct = useCallback(
    (lineId: string, product: ProductResponse) => {
      const rawPrice = resolveProductPrice(product)
      let unitValue: string | undefined
      if (rawPrice != null) {
        if (product.priceIncludesIva && product.applyIva && product.ivaRate) {
          const base =
            Math.round((rawPrice / (1 + product.ivaRate / 100)) * 100) / 100
          unitValue = String(base)
        } else {
          unitValue = String(rawPrice)
        }
      }

      let taxChargeId: string | undefined
      let taxPercent: string | undefined
      if (product.applyIva) {
        const matchedIva =
          chargeTaxes.find(
            (tax) =>
              isIvaTax(tax) &&
              (product.ivaRate == null || tax.percentage === product.ivaRate),
          ) ?? chargeTaxes.find((tax) => isIvaTax(tax))
        if (matchedIva) {
          taxChargeId = String(matchedIva.id)
          taxPercent = String(
            product.ivaRate ?? matchedIva.percentage ?? DEFAULT_IVA_PERCENT,
          )
        }
      } else {
        taxChargeId = ''
        taxPercent = '0'
      }

      let taxRetentionId: string | undefined
      if (product.retefuenteEnabled) {
        const matchedRete =
          retentionTaxes.find((tax) => {
            const label = `${tax.name ?? ''} ${tax.type ?? ''}`.toUpperCase()
            return (
              (label.includes('RETE') || label.includes('RENTA')) &&
              (product.retefuenteRate == null ||
                tax.percentage === product.retefuenteRate)
            )
          }) ??
          retentionTaxes.find((tax) => {
            const label = `${tax.name ?? ''} ${tax.type ?? ''}`.toUpperCase()
            return label.includes('RETE') || label.includes('RENTA')
          })
        if (matchedRete) {
          taxRetentionId = String(matchedRete.id)
        }
      }

      setLines((current) =>
        current.map((line) => {
          if (line.id !== lineId) return line
          return {
            ...line,
            productSearch: product.sku
              ? `${product.sku} — ${product.name}`
              : product.name,
            code: product.sku || '',
            description: product.description?.trim() || product.name,
            ...(unitValue !== undefined ? { unitValue } : {}),
            ...(taxChargeId !== undefined
              ? {
                  taxChargeId,
                  taxPercent: taxPercent ?? line.taxPercent,
                }
              : {}),
            ...(taxRetentionId !== undefined ? { taxRetentionId } : {}),
          }
        }),
      )

      setFieldErrors((current) => {
        const next = { ...current }
        const lineIndex = lines.findIndex((l) => l.id === lineId)
        if (lineIndex >= 0) {
          delete next[`line-${lineIndex}-description`]
        }
        return next
      })
    },
    [chargeTaxes, lines, retentionTaxes],
  )

  const addPayment = useCallback(() => setPayments((current) => [...current, createEmptyPayment()]), [])
  const removePayment = useCallback((id: string) => setPayments((current) => { if (current.length <= 1) return current; return current.filter((p) => p.id !== id) }), [])
  const updatePayment = useCallback((id: string, patch: Partial<PaymentEntry>) => setPayments((current) => current.map((p) => (p.id === id ? { ...p, ...patch } : p))), [])

  const handleFileSelect = useCallback((file: File | null) => {
    if (!file) return
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']
    if (!allowedTypes.includes(file.type)) { setErrorMessage('Solo se aceptan archivos PDF, JPG y PNG.'); return }
    if (file.size > 10 * 1024 * 1024) { setErrorMessage('El archivo no puede superar los 10 MB.'); return }
    setAttachedFile(file)
    setErrorMessage(null)
  }, [])

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    handleFileSelect(e.dataTransfer.files[0] ?? null)
  }, [handleFileSelect])

  const validate = useCallback((): boolean => {
    const nextErrors: Record<string, string> = {}
    if (!selectedCustomer) nextErrors.customer = 'Debe seleccionar un cliente.'
    if (!issueDate.trim()) nextErrors.issueDate = 'La fecha es obligatoria.'
    const hasValidLine = lines.some((line) => line.description.trim() && parseAmount(line.quantity) > 0 && parseAmount(line.unitValue) > 0)
    if (!hasValidLine) nextErrors.lines = 'Agrega al menos un ítem con descripción, cantidad y valor.'
    lines.forEach((line, index) => {
      if (!line.description.trim()) nextErrors[`line-${index}-description`] = 'No puede estar vacío'
      if (parseAmount(line.quantity) <= 0) nextErrors[`line-${index}-quantity`] = 'Cantidad inválida'
    })
    if (isCreditPayment && !dueDate.trim()) nextErrors.dueDate = 'La fecha de vencimiento es obligatoria a crédito.'
    setFieldErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }, [dueDate, isCreditPayment, issueDate, lines, selectedCustomer])

  const buildRequest = useCallback(() => {
    if (!selectedCustomer) throw new Error('Debe seleccionar un cliente.')
    const taxesById = new Map(taxes.map((tax) => [tax.id, tax]))
    const retentions = lines.map((line) => {
      const retentionId = Number(line.taxRetentionId)
      if (!Number.isFinite(retentionId) || retentionId <= 0) return null
      const tax = taxesById.get(retentionId)
      return { id: retentionId, type: tax?.type ?? tax?.name, percentage: tax?.percentage ?? undefined }
    }).filter((item): item is NonNullable<typeof item> => item != null)
    if (reteIcaId) {
      const reteIcaIdNum = Number(reteIcaId)
      if (!retentions.some((r) => r.id === reteIcaIdNum)) {
        const tax = taxesById.get(reteIcaIdNum)
        if (tax) retentions.push({ id: reteIcaIdNum, type: tax.type ?? tax.name, percentage: tax.percentage ?? undefined })
      }
    }
    const uniqueRetentions = Array.from(new Map(retentions.map((item) => [item.id, item])).values())
    const firstPayment = payments[0]
    const methodId = firstPayment ? Number(firstPayment.methodId) : 0
    const formId = Number(paymentFormId)
    const paymentDueDate = isCreditPayment ? dueDate.trim() || issueDate.trim() : issueDate.trim()
    const documentDiscount = lines.reduce(
      (sum, line) => sum + lineDiscountAmount(line, discountIsPercent),
      0,
    )
    return {
      issueDate: issueDate.trim(),
      customerDocumentType: selectedCustomer.document_type,
      customerIdentification: selectedCustomer.document_number,
      customerName: selectedCustomer.name,
      currency,
      ...(notes.trim() ? { observations: notes.trim() } : {}),
      ...(headNote.trim() ? { headNote: headNote.trim() } : {}),
      ...(footNote.trim() ? { footNote: footNote.trim() } : {}),
      ...(documentDiscount > 0 ? { discountAmount: documentDiscount } : {}),
      items: lines.filter((line) => line.description.trim()).map((line) => ({
        description: line.description.trim(),
        quantity: parseAmount(line.quantity),
        unitValue: parseAmount(line.unitValue),
        discount: lineDiscountAmount(line, discountIsPercent),
        taxAmount: lineTaxAmount(line, discountIsPercent),
        ...((line.code?.trim() || line.productSearch.trim())
          ? { code: line.code?.trim() || line.productSearch.trim() }
          : {}),
      })),
      ...(uniqueRetentions.length > 0 ? { retentions: uniqueRetentions } : {}),
      ...(Number.isFinite(methodId) && methodId > 0 ? { payment: { id: methodId, payment_form_id: Number.isFinite(formId) ? formId : 1, due_date: paymentDueDate } } : {}),
    }
  }, [currency, discountIsPercent, dueDate, footNote, headNote, isCreditPayment, issueDate, lines, notes, paymentFormId, payments, reteIcaId, selectedCustomer, taxes])

  const handleSubmit = useCallback(async (mode: SubmitMode) => {
    setErrorMessage(null)
    setSuccessMessage(null)
    if (!validate()) { setErrorMessage('Revisa los campos marcados antes de continuar.'); return }
    setIsSubmitting(true)
    setSubmitMode(mode)
    try {
      const response = await createJarvisInvoice(buildRequest())
      const consecutive = response.invoice?.consecutive || response.invoice?.number
      setSuccessMessage(
        consecutive
          ? `Factura de venta ${response.invoice?.prefix ?? ''} ${consecutive} ${mode === 'send' ? 'guardada y enviada a DIAN.' : 'enviada a DIAN.'}`
          : mode === 'send'
            ? 'Factura de venta guardada y enviada a DIAN.'
            : 'Factura de venta enviada a DIAN.',
      )
      if (typeof consecutive === 'number') setNextConsecutive(consecutive + 1)
      else if (nextConsecutive != null) setNextConsecutive(nextConsecutive + 1)
      resetForm()
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, mode === 'send' ? 'No se pudo guardar y enviar la factura de venta.' : 'No se pudo guardar la factura de venta.'))
    } finally { setIsSubmitting(false); setSubmitMode(null) }
  }, [buildRequest, nextConsecutive, resetForm, validate])

  const onFormSubmit = (event: FormEvent) => { event.preventDefault(); void handleSubmit('send') }

  return (
    <section className="ds-individual ds-individual--sales">
      <p className="ds-individual__breadcrumb">
        <Link to="/factura-venta">Factura de venta</Link>
        <span aria-hidden="true"> › </span>
        <span>Nueva factura de venta</span>
      </p>

      <div className="ds-individual__header">
        <h1 className="ds-individual__title">Nueva factura de venta</h1>
        <Link to="/configuracion/integracion-jarvis" className="ds-individual__config-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" width="16" height="16">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Configuración
        </Link>
      </div>

      {errorMessage && <ErrorMessage message={errorMessage} />}
      {successMessage && <SuccessMessage message={successMessage} />}

      <form className="ds-individual__form" onSubmit={onFormSubmit}>

        {/* Información general */}
        <section className="ds-individual__section">
          <h2>Información general</h2>
          <div className="ds-individual__info-grid">
            <div className="ds-individual__col">
              <label className="ds-individual__field ds-individual__field--date">
                <span>Fecha de elaboración <span className="ds-individual__required">*</span></span>
                <DatePicker value={issueDate} onChange={(val) => { setIssueDate(val); if (!isCreditPayment) setDueDate(val) }} />
                {fieldErrors.issueDate && <em className="ds-individual__error">{fieldErrors.issueDate}</em>}
              </label>

              <div className="ds-individual__field ds-individual__field--customer">
                <span>Cliente <span className="ds-individual__required">*</span></span>
                <div className="ds-individual__search">
                  <input
                    type="search" placeholder="Buscar cliente..." value={customerQuery} autoComplete="off"
                    onFocus={() => setIsCustomerMenuOpen(true)}
                    onChange={(e) => { setCustomerQuery(e.target.value); setSelectedCustomer(null); setIsCustomerMenuOpen(true) }}
                    onBlur={() => {
                      if (customerBlurTimeoutRef.current) window.clearTimeout(customerBlurTimeoutRef.current)
                      customerBlurTimeoutRef.current = window.setTimeout(() => setIsCustomerMenuOpen(false), 150)
                    }}
                  />
                  <span className="ds-individual__search-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
                    </svg>
                  </span>
                  {isCustomerMenuOpen && (
                    <ul className="ds-individual__supplier-list" role="listbox">
                      {isLoadingCustomers ? (
                        <li className="ds-individual__supplier-empty">Cargando clientes...</li>
                      ) : filteredCustomers.length === 0 ? (
                        <li className="ds-individual__supplier-empty">
                          {allCustomers.length === 0 ? 'No hay clientes creados aún.' : 'No hay coincidencias con esa búsqueda.'}
                        </li>
                      ) : filteredCustomers.slice(0, 50).map((item) => (
                        <li key={item.id}>
                          <button
                            type="button"
                            className={`ds-individual__supplier-option${selectedCustomer?.id === item.id ? ' is-selected' : ''}`}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => selectCustomer(item)}
                          >
                            <strong>{item.name}</strong>
                            <span>{item.document_type} {item.document_number}{item.check_digit ? `-${item.check_digit}` : ''}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {fieldErrors.customer && <em className="ds-individual__error">{fieldErrors.customer}</em>}
                {!selectedCustomer && (
                  <p className="ds-individual__hint">
                    ¿No encuentras el cliente?{' '}
                    <button type="button" onClick={() => setIsCreateCustomerOpen(true)}>Créalo aquí</button>
                    , sin perder lo que ya llevas en esta factura.
                  </p>
                )}
              </div>

              <label className="ds-individual__field ds-individual__field--checkbox">
                <span>Descuento en porcentaje</span>
                <input type="checkbox" checked={discountIsPercent} onChange={(e) => setDiscountIsPercent(e.target.checked)} />
              </label>
            </div>

            <div className="ds-individual__col">
              <div className="ds-individual__field ds-individual__field--number">
                <span>Número</span>
                <p className="ds-individual__readonly">
                  {nextConsecutive != null
                    ? `${nextConsecutive} (Numeración automática)`
                    : 'Numeración automática'}
                </p>
              </div>

              <div className="ds-individual__field ds-individual__field--prefix">
                <span>Prefijo</span>
                <div className="ds-individual__prefix-inline">
                  <input
                    id="doc-prefix"
                    type="text"
                    value={resolutionPrefix}
                    readOnly
                    className="ds-individual__prefix-input"
                  />
                  <span className="ds-individual__consecutive-label">Consecutivo</span>
                  <input
                    id="doc-consecutive"
                    type="text"
                    placeholder="Consecutivo"
                    value={nextConsecutive != null ? String(nextConsecutive) : ''}
                    readOnly
                    className="ds-individual__consecutive-input"
                  />
                </div>
              </div>

              <label className="ds-individual__field ds-individual__field--currency">
                <span>Moneda</span>
                <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                  {currencyOptions.map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}
                </select>
              </label>
            </div>
          </div>
        </section>

        {/* Detalle productos/servicios */}
        <section className="ds-individual__section">
          <div className="ds-individual__section-head">
            <h2>Detalle de productos o servicios</h2>
            <button type="button" className="ds-individual__add-line" onClick={() => setLines((current) => [...current, createEmptyLine()])}>
              + Agregar fila
            </button>
          </div>
          {fieldErrors.lines && <em className="ds-individual__error">{fieldErrors.lines}</em>}
          <div className="ds-individual__table-wrap">
            <table className="ds-individual__table">
              <thead>
                <tr>
                  <th className="ds-individual__th-num">#</th>
                  <th className="ds-individual__th-product">Producto / Servicio</th>
                  <th className="ds-individual__th-desc">Descripción</th>
                  <th className="ds-individual__th-qty">Cant.</th>
                  <th className="ds-individual__th-unit-price">Valor unitario</th>
                  <th className="ds-individual__th-discount">Descuento{discountIsPercent ? ' (%)' : ''}</th>
                  <th className="ds-individual__th-tax">Impuesto cargo</th>
                  <th className="ds-individual__th-tax">Impuesto retención</th>
                  <th className="ds-individual__th-total">Valor total</th>
                  <th className="ds-individual__th-actions" aria-label="Eliminar" />
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => (
                  <tr key={line.id}>
                    <td className="ds-individual__td-num">{index + 1}</td>
                    <td className="ds-individual__td-product">
                      <JarvisProductSearch
                        value={line.productSearch}
                        placeholder="Buscar..."
                        products={allProducts}
                        isLoading={isLoadingProducts}
                        onChange={(val) =>
                          updateLine(line.id, {
                            productSearch: val,
                            code: val,
                          })
                        }
                        onSelectProduct={(prod) =>
                          handleSelectProduct(line.id, prod)
                        }
                      />
                    </td>
                    <td className="ds-individual__td-desc">
                      <input type="text" value={line.description} placeholder="Descripción" onChange={(e) => updateLine(line.id, { description: e.target.value })} />
                      {fieldErrors[`line-${index}-description`] && <em className="ds-individual__error">{fieldErrors[`line-${index}-description`]}</em>}
                    </td>
                    <td className="ds-individual__td-qty">
                      <input type="text" inputMode="decimal" value={line.quantity} onChange={(e) => updateLine(line.id, { quantity: e.target.value })} />
                      {fieldErrors[`line-${index}-quantity`] && <em className="ds-individual__error">{fieldErrors[`line-${index}-quantity`]}</em>}
                    </td>
                    <td className="ds-individual__td-unit-price"><input type="text" inputMode="decimal" value={line.unitValue} onChange={(e) => updateLine(line.id, { unitValue: e.target.value })} /></td>
                    <td className="ds-individual__td-discount"><input type="text" inputMode="decimal" value={line.discount} onChange={(e) => updateLine(line.id, { discount: e.target.value })} /></td>
                    <td className="ds-individual__td-tax">
                      <select value={line.taxChargeId} onChange={(e) => updateLine(line.id, { taxChargeId: e.target.value, taxPercent: e.target.value ? line.taxPercent || String(DEFAULT_IVA_PERCENT) : '0' })}>
                        <option value="">Seleccionar</option>
                        {chargeTaxes.map((tax) => <option key={tax.id} value={tax.id}>{tax.name}</option>)}
                      </select>
                    </td>
                    <td className="ds-individual__td-tax">
                      <select value={line.taxRetentionId} onChange={(e) => updateLine(line.id, { taxRetentionId: e.target.value })}>
                        <option value="">Seleccionar</option>
                        {retentionTaxes.map((tax) => <option key={tax.id} value={tax.id}>{tax.name}</option>)}
                      </select>
                    </td>
                    <td className="ds-individual__td-total ds-individual__total-cell">{formatMoney(lineTotal(line, discountIsPercent))}</td>
                    <td className="ds-individual__td-actions">
                      <button type="button" className="ds-individual__delete" aria-label="Eliminar línea" disabled={lines.length <= 1} onClick={() => removeLine(line.id)}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Formas de pago + Totales */}
        <section className="ds-individual__section">
          <div className="ds-individual__payment-totals-grid">
            <div className="ds-individual__payment-col">
              <h2>Formas de pago</h2>
              <label className="ds-individual__field">
                <span>Forma de negociación</span>
                <select value={paymentFormId} onChange={(e) => {
                  setPaymentFormId(e.target.value)
                  const isCredit = paymentForms.length > 0 ? (paymentForms.find((f) => String(f.id) === e.target.value)?.name?.toLowerCase().includes('cr') ?? e.target.value === '2') : e.target.value === '2'
                  if (!isCredit) setDueDate(issueDate)
                }}>
                  {paymentForms.length > 0 ? paymentForms.map((form) => <option key={form.id} value={form.id}>{form.name}</option>) : (<><option value="1">Contado</option><option value="2">Crédito</option></>)}
                </select>
              </label>

              {payments.map((payment, idx) => (
                <div key={payment.id} className="ds-individual__field ds-individual__field--payment-method">
                  <span>{idx === 0 ? 'Selecciona forma de pago' : ''}</span>
                  <div className="ds-individual__payment-controls">
                    <select value={payment.methodId} onChange={(e) => updatePayment(payment.id, { methodId: e.target.value })}>
                      <option value="">Selecciona forma de pago</option>
                      {paymentMethods.map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}
                    </select>
                    <input type="text" inputMode="decimal" value={payment.amount} onChange={(e) => updatePayment(payment.id, { amount: e.target.value })} />
                    <button
                      type="button"
                      className="ds-individual__delete ds-individual__delete--payment"
                      aria-label="Eliminar forma de pago"
                      onClick={() => removePayment(payment.id)}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </button>
                  </div>
                </div>
              ))}

              <button type="button" className="ds-individual__add-payment" onClick={addPayment}>
                + Agregar otra forma de pago
              </button>

              <label className="ds-individual__field ds-individual__field--due">
                <span>Fecha de vencimiento</span>
                <DatePicker value={dueDate} onChange={setDueDate} disabled={!isCreditPayment} minDate={issueDate} />
                {!isCreditPayment && (
                  <p className="ds-individual__hint ds-individual__hint--info">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" strokeLinecap="round" /></svg>
                    La fecha de vencimiento solo aplica para facturas con forma de negociación a crédito.
                  </p>
                )}
                {fieldErrors.dueDate && <em className="ds-individual__error">{fieldErrors.dueDate}</em>}
              </label>

              {isCreditPayment && (
                <label className="ds-individual__field">
                  <span>Plazo (días)</span>
                  <div className="ds-individual__term">
                    <input type="number" inputMode="numeric" min={0} value={plazoDays} onChange={(e) => { const days = e.target.value === '' ? 0 : Math.max(0, Number(e.target.value)); setDueDate(addDaysToLocalDate(issueDate, days)) }} placeholder="0" />
                    <span className="ds-individual__term-suffix">días</span>
                  </div>
                </label>
              )}
            </div>

            <div className="ds-individual__totals-col">
              <div className="ds-individual__totals">
                <div className="ds-individual__totals-row"><span>Total bruto:</span><strong>{formatMoney(documentGross)}</strong></div>
                <div className="ds-individual__totals-row"><span>Descuentos:</span><strong>{formatMoney(documentDiscounts)}</strong></div>
                <div className="ds-individual__totals-row"><span>Subtotal:</span><strong>{formatMoney(documentSubtotal)}</strong></div>
                <div className="ds-individual__totals-row ds-individual__totals-row--reteica">
                  <span>ReteICA:</span>
                  <div className="ds-individual__reteica-group">
                    <select value={reteIcaId} onChange={(e) => setReteIcaId(e.target.value)} className="ds-individual__reteica-select">
                      <option value="">Seleccionar</option>
                      {retentionTaxes.filter((t) => (t.name ?? '').toUpperCase().includes('ICA')).map((tax) => <option key={tax.id} value={tax.id}>{tax.name}</option>)}
                    </select>
                    <strong>{formatMoney(reteIcaTax)}</strong>
                  </div>
                </div>
                <div className="ds-individual__totals-row ds-individual__totals-row--net">
                  <span>Total neto:</span>
                  <strong>{formatMoney(documentTotal)}</strong>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Comentarios y anexos */}
        <section className="ds-individual__section">
          <h2>Comentarios y anexos</h2>
          <div className="ds-individual__comments-grid">
            <label className="ds-individual__field">
              <textarea rows={5} value={notes} maxLength={500} onChange={(e) => setNotes(e.target.value)} placeholder='Aquí puedes ingresar comentarios adicionales o información para tu cliente. Por ejemplo: "Favor consignar a la cuenta No. 000000 del banco XYZ".' />
              <span className="ds-individual__char-count">{notes.length}/500</span>
            </label>

            <div
              className={`ds-individual__dropzone${isDragging ? ' is-dragging' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              role="button" tabIndex={0} aria-label="Adjuntar archivo"
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click() }}
            >
              <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="ds-individual__file-input" onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)} />
              {attachedFile ? (
                <div className="ds-individual__file-info">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" width="28" height="28">
                    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" strokeLinejoin="round" />
                    <path d="M14 3v5h5" strokeLinejoin="round" />
                    <path d="M9 13l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="ds-individual__file-name">{attachedFile.name}</span>
                  <span className="ds-individual__file-size">{formatFileSize(attachedFile.size)}</span>
                  <button type="button" className="ds-individual__file-remove" aria-label="Quitar archivo" onClick={(e) => { e.stopPropagation(); setAttachedFile(null) }}>✕</button>
                </div>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" width="28" height="28">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <p className="ds-individual__dropzone-text">Adjuntar archivo</p>
                  <p className="ds-individual__dropzone-hint">Arrastra un archivo o haz clic para seleccionar<br />PDF, JPG, PNG (máx. 10 MB)</p>
                </>
              )}
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="ds-individual__actions">
          <button type="button" className="ds-individual__btn ds-individual__btn--ghost" disabled={isSubmitting} onClick={() => navigate('/inicio')}>
            Cancelar
          </button>
          <button type="button" className="ds-individual__btn ds-individual__btn--outline" disabled={isSubmitting} onClick={() => void handleSubmit('save')}>
            {isSubmitting && submitMode === 'save' ? 'Guardando...' : 'Guardar'}
          </button>
          <button type="submit" className="ds-individual__btn ds-individual__btn--primary" disabled={isSubmitting}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
              <line x1="22" y1="2" x2="11" y2="13" strokeLinecap="round" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" strokeLinejoin="round" />
            </svg>
            {isSubmitting && submitMode === 'send' ? 'Enviando...' : 'Guardar y enviar'}
          </button>
        </footer>
      </form>

      <CreateJarvisTerceroModal
        isOpen={isCreateCustomerOpen}
        onClose={() => setIsCreateCustomerOpen(false)}
        initialDocumentNumber={customerQuery}
        onCreated={(tercero) => { setAllCustomers((current) => [tercero, ...current]); selectCustomer(tercero); setIsCreateCustomerOpen(false) }}
      />
    </section>
  )
}

export default SalesInvoicePage
