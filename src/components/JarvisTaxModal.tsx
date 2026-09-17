import { type FormEvent, useEffect, useState } from 'react'
import Button from './Button'
import ErrorMessage from './ErrorMessage'
import Modal from './Modal'
import { getApiErrorMessage } from '../services/apiClient'
import { createJarvisTax, updateJarvisTax } from '../services/jarvisService'
import {
  isReteIcaTaxType,
  JARVIS_TAX_TYPE_SUGGESTIONS,
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
  const [form, setForm] = useState<TaxFormState>(buildEmptyForm)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    setForm(editingTax ? buildFormFromTax(editingTax) : buildEmptyForm())
    setErrorMessage(null)
  }, [isOpen, editingTax])

  const handleClose = () => {
    if (isSaving) return
    onClose()
  }

  const isReteIca = isReteIcaTaxType(form.taxType)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSaving(true)
    setErrorMessage(null)

    try {
      // ReteICA nunca lleva tarifa manual (se divide en mil por defecto,
      // pedido explícito) — aunque el campo esté oculto y el usuario no
      // haya tocado nada, se manda null en vez de un valor que haya
      // quedado de un tipo anterior.
      const trimmedRate = form.rate.trim()
      const rate = isReteIca || !trimmedRate ? null : Number(trimmedRate)

      if (!isReteIca && trimmedRate && !Number.isFinite(rate)) {
        throw new Error('La tarifa debe ser un número válido.')
      }

      if (editingTax) {
        // El código NUNCA se manda a editar (es el id interno con el que
        // se identifica en el resto de tablas — ver decisión del pedido
        // original): solo se muestra de referencia, no viaja en el update.
        const response = await updateJarvisTax(editingTax.id, {
          name: form.name.trim(),
          tax_type: form.taxType.trim(),
          rate,
          is_active: form.isActive,
        })
        onSaved(response.tax)
      } else {
        // Tampoco al crear: el cliente solo elige nombre/tipo/tarifa — el
        // código lo asigna el backend, y nace siempre Activo.
        const response = await createJarvisTax({
          category: defaultCategory,
          name: form.name.trim(),
          tax_type: form.taxType.trim(),
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
            <input
              id="jarvis-tax-type"
              type="text"
              list="jarvis-tax-type-suggestions"
              value={form.taxType}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  taxType: event.target.value,
                }))
              }
              disabled={isSaving}
              required
            />
            <datalist id="jarvis-tax-type-suggestions">
              {JARVIS_TAX_TYPE_SUGGESTIONS.map((suggestion) => (
                <option key={suggestion} value={suggestion} />
              ))}
            </datalist>
          </div>

          {/* ReteICA se divide en mil por defecto — no se le pide tarifa
              manual (pedido explícito). Para cualquier otro tipo, sí. */}
          {!isReteIca && (
            <div className="terceros-page__field">
              <label htmlFor="jarvis-tax-rate">Tarifa (%)</label>
              <input
                id="jarvis-tax-rate"
                type="number"
                step="0.0001"
                value={form.rate}
                onChange={(event) =>
                  setForm((current) => ({ ...current, rate: event.target.value }))
                }
                disabled={isSaving}
              />
            </div>
          )}

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
          <Button type="submit" variant="primary" disabled={isSaving}>
            {isSaving ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default JarvisTaxModal
