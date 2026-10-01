import { type FormEvent, useEffect, useState } from 'react'
import Button from './Button'
import ErrorMessage from './ErrorMessage'
import Modal from './Modal'
import { getApiErrorMessage } from '../services/apiClient'
import { createJarvisTax, updateJarvisTax, fetchJarvisCatalogs, type JarvisCatalogItem } from '../services/jarvisService'
import { normalizeJarvisTaxType, taxPresetLabel, taxPresetRates } from '../utils/jarvisTaxPresets'
import {
  isReteIcaTaxType,
  type JarvisTax,
  type JarvisTaxCategory,
} from '../types/jarvis'
import '../pages/TercerosPage.css'

export interface JarvisTaxModalProps {
  isOpen: boolean
  onClose: () => void
  /** Categoría con la que se crea un impuesto nuevo — ya no la elige el
   * usuario (no hay pestañas Impuestos/Retenciones separadas, ver decisión
   * del pedido original), la fija siempre la página que abre el modal. */
  defaultCategory: JarvisTaxCategory
  /** Si viene con valor, el modal edita ese impuesto en vez de crear uno nuevo. */
  editingTax?: JarvisTax | null
  onSaved: (tax: JarvisTax) => void
}

interface TaxFormState {
  code: string
  name: string
  taxType: string
  rate: string
  isActive: boolean
}

function buildEmptyForm(): TaxFormState {
  return {
    code: '',
    name: '',
    taxType: '',
    rate: '',
    isActive: true,
  }
}

function buildFormFromTax(tax: JarvisTax): TaxFormState {
  return {
    code: tax.code,
    name: tax.name,
    taxType: tax.tax_type,
    rate: tax.rate === null ? '' : String(tax.rate),
    isActive: tax.is_active,
  }
}

function JarvisTaxModal({
  isOpen,
  onClose,
  defaultCategory,
  editingTax,
  onSaved,
}: JarvisTaxModalProps) {
  const [form, setForm] = useState<TaxFormState>(() => editingTax ? buildFormFromTax(editingTax) : buildEmptyForm())
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [taxTypes, setTaxTypes] = useState<JarvisCatalogItem[]>([])
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [catalogRevision, setCatalogRevision] = useState(0)
  const [customRate, setCustomRate] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    let active = true
    fetchJarvisCatalogs().then(catalog => {
      if (active) setTaxTypes(catalog.taxes)
    }).catch(error => {
      if (active) setCatalogError(getApiErrorMessage(error, 'No se pudieron cargar los tipos de impuesto.'))
    }).finally(() => { if (active) setCatalogLoading(false) })
    return () => { active = false }
  }, [isOpen, catalogRevision])

  const handleClose = () => {
    if (isSaving) return
    onClose()
  }

  const isReteIca = isReteIcaTaxType(form.taxType)
  const rates = taxPresetRates(form.taxType)
  const selectedMaster = taxTypes.find(tax => normalizeJarvisTaxType(tax.name) === normalizeJarvisTaxType(form.taxType))
  const rateIsCustom = customRate || (form.rate !== '' && !rates.includes(Number(form.rate)))

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSaving(true)
    setErrorMessage(null)

    try {
      if (catalogLoading || catalogError || !selectedMaster) throw new Error('Selecciona un tipo de impuesto de la tabla maestra.')
      const trimmedRate = form.rate.trim()
      const rate = !trimmedRate ? null : Number(trimmedRate.replace(',', '.'))

      if (trimmedRate && (!Number.isFinite(rate) || Number(rate) < 0)) {
        throw new Error('La tarifa debe ser un número válido.')
      }

      if (editingTax) {
        // El código NUNCA se manda a editar (es el id interno con el que
        // se identifica en el resto de tablas — ver decisión del pedido
        // original): solo se muestra de referencia, no viaja en el update.
        const response = await updateJarvisTax(editingTax.id, {
          category: form.taxType.trim().toLowerCase().startsWith('rete') ? 'RETENCION' : 'IMPUESTO',
          name: form.name.trim(),
          tax_type: selectedMaster.name,
          rate,
          is_active: form.isActive,
        })
        onSaved(response.tax)
      } else {
        // Tampoco al crear: el cliente solo elige nombre/tipo/tarifa — el
        // código lo asigna el backend, y nace siempre Activo.
        const response = await createJarvisTax({
          category: form.taxType.trim().toLowerCase().startsWith('rete') ? 'RETENCION' : defaultCategory,
          name: form.name.trim(),
          tax_type: selectedMaster.name,
          rate,
        })
        onSaved(response.tax)
      }

      onClose()
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(error, 'No se pudo guardar el impuesto.'),
      )
    } finally {
      setIsSaving(false)
    }
  }

  const title = editingTax ? 'Editar impuesto' : 'Agregar impuesto'

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      busy={isSaving}
      labelledBy="jarvis-tax-modal-title"
      className="terceros-page__dialog"
    >
      <h2 id="jarvis-tax-modal-title" className="modal-dialog__title">
        {title}
      </h2>

      {errorMessage && <ErrorMessage message={errorMessage} />}
      {catalogError && <><ErrorMessage message={catalogError} /><Button variant="outline" onClick={() => {
        setCatalogLoading(true)
        setCatalogError(null)
        setCatalogRevision(value => value + 1)
      }}>Reintentar</Button></>}

      <form onSubmit={handleSubmit}>
        <div className="terceros-page__form-grid">
          {editingTax && (
            <div className="terceros-page__field">
              <label htmlFor="jarvis-tax-code">Código</label>
              <input
                id="jarvis-tax-code"
                type="text"
                value={form.code}
                disabled
                title="Numeración interna asignada automáticamente — no se puede editar."
              />
            </div>
          )}

          <div className="terceros-page__field">
            <label htmlFor="jarvis-tax-name">Nombre</label>
            <input
              id="jarvis-tax-name"
              type="text"
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({ ...current, name: event.target.value }))
              }
              disabled={isSaving}
              required
            />
          </div>

          <div className="terceros-page__field terceros-page__field--full">
            <label htmlFor="jarvis-tax-type">Tipo de impuesto</label>
            <select
              id="jarvis-tax-type"
              value={selectedMaster?.name ?? form.taxType}
              onChange={(event) => {
                setCustomRate(false)
                setForm((current) => ({
                  ...current,
                  taxType: event.target.value,
                  rate: '',
                }))
              }}
              disabled={isSaving || catalogLoading || Boolean(catalogError)}
              required
            >
              <option value="">{catalogLoading ? 'Cargando tipos…' : 'Selecciona un tipo'}</option>
              {form.taxType && !selectedMaster && <option value={form.taxType} disabled>{form.taxType} (selecciona un tipo vigente)</option>}
              {taxTypes.map(tax => <option key={tax.id} value={tax.name}>{tax.name}</option>)}
            </select>
          </div>

          <div className="terceros-page__field">
            <label htmlFor="jarvis-tax-rate">{isReteIca ? 'Tarifa (x 1.000)' : 'Tarifa (%)'}</label>
            {rates.length > 0 && <select id="jarvis-tax-rate" value={rateIsCustom ? 'custom' : form.rate} disabled={isSaving} onChange={event => {
              const value = event.target.value
              setCustomRate(value === 'custom')
              setForm(current => ({ ...current, rate: value === 'custom' ? '' : value }))
            }}>
              <option value="">Selecciona una tarifa</option>
              {rates.map(rate => <option key={rate} value={String(rate)}>{taxPresetLabel(form.taxType, rate)}</option>)}
              <option value="custom">Otra tarifa</option>
            </select>}
            {(rates.length === 0 || rateIsCustom) && <input id={rates.length ? 'jarvis-tax-custom-rate' : 'jarvis-tax-rate'} aria-label="Tarifa personalizada" type="number" min="0" step="0.0001" value={form.rate}
              onChange={event => setForm(current => ({ ...current, rate: event.target.value }))} disabled={isSaving} />
            }
          </div>

          {editingTax && (
            <div className="terceros-page__field">
              <label htmlFor="jarvis-tax-active">Estado</label>
              <select
                id="jarvis-tax-active"
                value={form.isActive ? 'true' : 'false'}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    isActive: event.target.value === 'true',
                  }))
                }
                disabled={isSaving}
              >
                <option value="true">Activo</option>
                <option value="false">Inactivo</option>
              </select>
            </div>
          )}
        </div>

        <div className="modal-dialog__actions">
          <Button
            variant="secondary"
            onClick={handleClose}
            disabled={isSaving}
          >
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={isSaving || catalogLoading || Boolean(catalogError) || !selectedMaster}>
            {isSaving ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default function JarvisTaxModalDialog(props: JarvisTaxModalProps) {
  return props.isOpen ? <JarvisTaxModal key={props.editingTax?.id ?? 'new'} {...props} /> : null
}
