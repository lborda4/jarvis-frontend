import { lazy, Suspense, useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiClient, getApiErrorMessage } from '../services/apiClient'
import { fetchInvoiceAppearance, saveInvoiceAppearance } from '../services/invoiceAppearanceService'
import { fetchJarvisCredentialsStatus } from '../services/jarvisService'
import { DEFAULT_INVOICE_APPEARANCE, normalizeInvoiceColor, type InvoiceAppearance } from '../utils/invoiceAppearance'
import { invoiceAppearanceSample } from '../utils/invoiceAppearanceSample'
import { loadSalesInvoicePdfRenderer } from '../utils/loadSalesInvoicePdfRenderer'
import type { AuthCompany } from '../types/auth'
import type { JarvisCredentialsStatusResponse } from '../types/jarvis'
import Button from './Button'
import ErrorMessage from './ErrorMessage'
import PdfViewerErrorBoundary from './PdfViewerErrorBoundary'
import { DocumentIcon } from './icons/SidebarIcons'
import './InvoiceAppearanceSettings.css'

const JarvisPdfViewer = lazy(() => import('./JarvisPdfViewer'))
const presets = [
  { name: 'Turquesa', token: '--invoice-color-teal' }, { name: 'Azul marino', token: '--invoice-color-navy' },
  { name: 'Azul acero', token: '--invoice-color-blue' }, { name: 'Azul petróleo', token: '--invoice-color-petrol' },
  { name: 'Gris pizarra', token: '--invoice-color-gray' }, { name: 'Gris antracita', token: '--invoice-color-charcoal' },
  { name: 'Topo', token: '--invoice-color-taupe' },
]

export default function InvoiceAppearanceSettings() {
  const { user } = useAuth()
  return user?.company ? <AppearanceEditor key={user.company.id} company={user.company} /> : null
}

function AppearanceEditor({ company }: { company: AuthCompany }) {
  const [expanded, setExpanded] = useState(false)
  const bodyId = useId()
  const [appearance, setAppearance] = useState<InvoiceAppearance>(DEFAULT_INVOICE_APPEARANCE)
  const [saved, setSaved] = useState<InvoiceAppearance>(DEFAULT_INVOICE_APPEARANCE)
  const [hexInput, setHexInput] = useState(DEFAULT_INVOICE_APPEARANCE.accentColor)
  const [palette, setPalette] = useState<Record<string, string>>({})
  const [settings, setSettings] = useState<Partial<JarvisCredentialsStatusResponse>>({})
  const [logo, setLogo] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [previewAttempt, setPreviewAttempt] = useState(0)
  const [preview, setPreview] = useState({ key: '', url: '', error: '' })
  const savingRef = useRef(false)
  const mountedRef = useRef(true)
  const previewUrlRef = useRef('')
  const previewQueue = useRef<Promise<void>>(Promise.resolve())
  const validColor = normalizeInvoiceColor(hexInput)
  const dirty = JSON.stringify(appearance) !== JSON.stringify(saved)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const tokens = getComputedStyle(document.documentElement)
    setPalette(Object.fromEntries(presets.map(preset => [preset.token, normalizeInvoiceColor(tokens.getPropertyValue(preset.token)) ?? DEFAULT_INVOICE_APPEARANCE.accentColor])))
    fetchInvoiceAppearance(controller.signal).then(value => {
      if (!controller.signal.aborted) { setAppearance(value); setSaved(value); setHexInput(value.accentColor); setLoaded(true); setError('') }
    }).catch(err => { if (!controller.signal.aborted) setError(getApiErrorMessage(err, 'No se pudo cargar la personalización de tu factura.')) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    void fetchJarvisCredentialsStatus().then(value => { if (!controller.signal.aborted) setSettings(value) }).catch(() => { /* The preview can use the company name and sample contact data. */ })
    const refreshLogo = () => {
      void apiClient.get<{ logoDataUrl: string | null }>('/integrations/JARVIS/logo', { signal: controller.signal })
        .then(({ data }) => { if (!controller.signal.aborted) setLogo(data.logoDataUrl) }).catch(() => { /* A logo is optional. */ })
    }
    refreshLogo()
    window.addEventListener('jarvis:company-logo-updated', refreshLogo)
    return () => { controller.abort(); window.removeEventListener('jarvis:company-logo-updated', refreshLogo) }
  }, [attempt])

  const sample = useMemo(() => invoiceAppearanceSample(company, settings, appearance, logo), [company, settings, appearance, logo])
  const previewKey = JSON.stringify([sample, previewAttempt])

  useEffect(() => {
    if (!loaded || !expanded) return
    let active = true
    const timer = window.setTimeout(() => {
      previewQueue.current = previewQueue.current.then(async () => {
        try {
          if (!active) return
          const renderer = await loadSalesInvoicePdfRenderer()
          if (!active) return
          const blob = await renderer.generateSalesInvoicePdf(sample)
          if (!active) return
          const objectUrl = URL.createObjectURL(blob)
          const previousUrl = previewUrlRef.current
          previewUrlRef.current = objectUrl
          setPreview({ key: previewKey, url: objectUrl, error: '' })
          if (previousUrl) URL.revokeObjectURL(previousUrl)
        } catch {
          if (active) setPreview({ key: previewKey, url: '', error: 'No pudimos generar la factura de ejemplo. Intenta nuevamente.' })
        }
      })
    }, 300)
    return () => { active = false; window.clearTimeout(timer) }
  }, [loaded, expanded, sample, previewKey])

  function change(next: Partial<InvoiceAppearance>) {
    setAppearance(current => ({ ...current, ...next })); setSuccess('')
  }
  function selectColor(color: string) { setHexInput(color); change({ accentColor: color }) }

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!loaded || !validColor || savingRef.current) return
    savingRef.current = true; setSaving(true); setError(''); setSuccess('')
    try {
      const result = await saveInvoiceAppearance({ ...appearance, accentColor: validColor })
      if (mountedRef.current) {
        setAppearance(result); setSaved(result); setHexInput(result.accentColor)
        setSuccess('Personalización guardada. Se aplicará al PDF de tus facturas de venta y a los correos que envíes desde Jarvis.')
      }
    } catch (err) { if (mountedRef.current) setError(getApiErrorMessage(err, 'No se pudo guardar la personalización. Tus cambios siguen disponibles para reintentar.')) }
    finally { savingRef.current = false; if (mountedRef.current) setSaving(false) }
  }

  const updatingPreview = preview.key !== previewKey
  const currentPreview = updatingPreview ? { ...preview, error: '' } : preview
  return <section className={`settings-accordion__panel invoice-appearance${expanded ? ' settings-accordion__panel--open' : ''}`} aria-labelledby="invoice-appearance-title" aria-busy={loading || saving}>
    <button type="button" className="settings-accordion__trigger" aria-expanded={expanded} aria-controls={bodyId} disabled={saving} onClick={() => setExpanded(current => !current)}>
      <span className="settings-accordion__badge" aria-hidden="true"><DocumentIcon /></span>
      <span className="settings-accordion__copy">
        <strong id="invoice-appearance-title">Personaliza tu factura de venta</strong>
        <small>{dirty ? 'Tienes cambios sin guardar' : 'Colores, logo y mensaje al pie'}</small>
      </span>
      <span className="settings-accordion__chevron" aria-hidden="true" />
    </button>
    <div id={bodyId} className="settings-accordion__content" hidden={!expanded} role="region" aria-labelledby="invoice-appearance-title">
      {loading && <p role="status">Cargando personalización…</p>}
      {error && <ErrorMessage inline message={error} />}
      {!loading && !loaded && <Button variant="outline" onClick={() => { setLoading(true); setAttempt(value => value + 1) }}>Volver a cargar</Button>}
      {loaded && <div className="invoice-appearance__layout">
        <form className="invoice-appearance__form" onSubmit={event => void save(event)}>
          <fieldset disabled={saving}>
            <legend>Color de la factura</legend>
            <p className="invoice-appearance__help">Se aplica a los encabezados, la tabla y los totales.</p>
            <div className="invoice-appearance__palette" role="group" aria-label="Colores predeterminados">
              {presets.map(preset => <button key={preset.token} type="button" className="invoice-appearance__swatch" style={{ backgroundColor: `var(${preset.token})` }} aria-label={preset.name} aria-pressed={palette[preset.token] === appearance.accentColor} title={preset.name} onClick={() => selectColor(palette[preset.token])} />)}
            </div>
            <label className="invoice-appearance__field" htmlFor="invoice-color-hex">Color personalizado</label>
            <div className="invoice-appearance__color-input">
              <input type="color" aria-label="Elegir un color personalizado" value={appearance.accentColor} onChange={event => selectColor(event.target.value.toUpperCase())} />
              <input id="invoice-color-hex" type="text" value={hexInput} maxLength={7} spellCheck={false} autoComplete="off" aria-invalid={!validColor} aria-describedby="invoice-color-help" onBlur={() => { if (validColor) setHexInput(validColor) }} onChange={event => {
                setHexInput(event.target.value); const color = normalizeInvoiceColor(event.target.value); if (color) change({ accentColor: color })
              }} />
            </div>
            <p id="invoice-color-help" className={`invoice-appearance__help${validColor ? '' : ' invoice-appearance__help--error'}`}>{validColor ? 'Usa el formato #RRGGBB. El texto se ajusta para mantener su legibilidad.' : 'Escribe un color hexadecimal válido, por ejemplo #00A8A8.'}</p>
            <label className="invoice-appearance__checkbox"><input type="checkbox" checked={appearance.showLogo} onChange={event => change({ showLogo: event.target.checked })} />Mostrar el logo de mi empresa</label>
            <p className="invoice-appearance__help">Puedes subirlo en la sección «Logo de la empresa».</p>
            <label className="invoice-appearance__field" htmlFor="invoice-footer-text">Mensaje al pie (opcional)</label>
            <textarea id="invoice-footer-text" rows={4} maxLength={300} value={appearance.footerText} placeholder="Gracias por confiar en nosotros." onChange={event => change({ footerText: event.target.value })} />
            <p className="invoice-appearance__help">{appearance.footerText.length}/300 caracteres</p>
            <div className="invoice-appearance__actions">
              <Button type="submit" disabled={!dirty || !validColor || saving}>{saving ? 'Guardando…' : 'Guardar personalización'}</Button>
              <Button variant="ghost" onClick={() => { setAppearance(DEFAULT_INVOICE_APPEARANCE); setHexInput(DEFAULT_INVOICE_APPEARANCE.accentColor); setSuccess('') }}>Restablecer diseño</Button>
            </div>
            {dirty && <p className="invoice-appearance__help">Tienes cambios sin guardar.</p>}
          </fieldset>
          {success && <p className="invoice-appearance__success" role="status">{success}</p>}
        </form>
        <div className="invoice-appearance__preview" aria-labelledby="invoice-preview-heading" aria-busy={updatingPreview}>
          <div className="invoice-appearance__preview-heading"><h3 id="invoice-preview-heading">Factura de ejemplo</h3><span>Vista previa</span></div>
          <p className="invoice-appearance__help">Datos ilustrativos. Esta prueba no emite una factura ni consume documentos.</p>
          {updatingPreview && preview.url && <p className="invoice-appearance__help" role="status">Actualizando diseño…</p>}
          {currentPreview?.error ? <div><ErrorMessage inline message={currentPreview.error} /><Button variant="outline" onClick={() => setPreviewAttempt(value => value + 1)}>Reintentar vista previa</Button></div>
            : currentPreview?.url ? <PdfViewerErrorBoundary key={currentPreview.url}><Suspense fallback={<p role="status">Cargando visor…</p>}><JarvisPdfViewer key={currentPreview.url} url={currentPreview.url} initialZoom="width" /></Suspense></PdfViewerErrorBoundary>
              : <div className="invoice-appearance__preview-loading" role="status">Actualizando factura de ejemplo…</div>}
          {!updatingPreview && currentPreview.url && <a className="invoice-appearance__download" href={currentPreview.url} download="factura-de-ejemplo.pdf">Descargar ejemplo en PDF</a>}
        </div>
      </div>}
    </div>
  </section>
}
