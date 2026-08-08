import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import ErrorMessage from './ErrorMessage'
import { getApiErrorMessage } from '../services/apiClient'
import { resumeElectronicDocument } from '../services/electronicDocumentService'
import {
  createJarvisTercero,
  lookupJarvisTerceroByNit,
} from '../services/jarvisService'
import {
  JARVIS_DOCUMENT_TYPE,
  JARVIS_DOCUMENT_TYPE_OPTIONS,
  JARVIS_ENTITY_TYPE_OPTIONS,
  JARVIS_TAX_REGIME_OPTIONS,
  type CreateJarvisTerceroRequest,
  type JarvisDocumentType,
  type JarvisEntityType,
  type JarvisTaxRegime,
  type JarvisTercero,
} from '../types/jarvis'
import '../pages/TercerosPage.css'
import '../pages/InvoiceUpload.css'

const EMPTY_FORM: CreateJarvisTerceroRequest = {
  document_type: JARVIS_DOCUMENT_TYPE.NIT,
  document_number: '',
  name: '',
  check_digit: '',
  email: '',
  phone: '',
  address: '',
}

export interface CreateJarvisTerceroModalProps {
  isOpen: boolean
  onClose: () => void
  initialDocumentType?: string | null
  initialDocumentNumber?: string | null
  /** Si se indica, reanuda la preparación del documento soporte tras crear el tercero. */
  resumeDocumentId?: string | null
  onCreated?: (tercero: JarvisTercero) => void
}

function resolveDocumentType(value?: string | null): JarvisDocumentType {
  return JARVIS_DOCUMENT_TYPE_OPTIONS.some((option) => option.value === value)
    ? (value as JarvisDocumentType)
    : JARVIS_DOCUMENT_TYPE.NIT
}

function CreateJarvisTerceroModal({
  isOpen,
  onClose,
  initialDocumentType,
  initialDocumentNumber,
  resumeDocumentId,
  onCreated,
}: CreateJarvisTerceroModalProps) {
  const [form, setForm] = useState<CreateJarvisTerceroRequest>(EMPTY_FORM)
  const [isSaving, setIsSaving] = useState(false)
  const [isLookingUpNit, setIsLookingUpNit] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [lookupMessage, setLookupMessage] = useState<string | null>(null)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const openedKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (!isOpen) {
      openedKeyRef.current = null
      return
    }

    const openKey = `${initialDocumentType ?? ''}|${initialDocumentNumber ?? ''}|${resumeDocumentId ?? ''}`
    if (openedKeyRef.current === openKey) {
      return
    }

    openedKeyRef.current = openKey
    setForm({
      ...EMPTY_FORM,
      document_type: resolveDocumentType(initialDocumentType),
      document_number: initialDocumentNumber?.trim() || '',
    })
    setErrorMessage(null)
    setLookupMessage(null)
    setLookupError(null)
  }, [isOpen, initialDocumentType, initialDocumentNumber, resumeDocumentId])

  const handleLookupDocument = useCallback(
    async (documentType: JarvisDocumentType, rawDocumentValue: string) => {
      const [rawDocumentNumber, rawCheckDigit] = rawDocumentValue.split('-')
      const documentNumber = rawDocumentNumber.replace(/\D/g, '')
      const typedCheckDigit = rawCheckDigit?.replace(/\D/g, '') ?? ''

      if (documentNumber.length < 5) {
        setLookupError(
          'Ingresa un número de documento válido (mínimo 5 dígitos) para autocompletar.',
        )
        setLookupMessage(null)
        return
      }

      if (isLookingUpNit) {
        return
      }

      setLookupMessage(null)
      setLookupError(null)
      setIsLookingUpNit(true)

      try {
        const response = await lookupJarvisTerceroByNit(
          documentNumber,
          documentType,
        )
        setForm((current) => ({
          ...current,
          document_number: response.document_number,
          check_digit: response.check_digit ?? typedCheckDigit,
          name: response.name ?? '',
          email: response.email ?? '',
          phone: response.phone ?? '',
          address: response.address ?? '',
        }))
        setLookupMessage(
          response.found
            ? 'Datos encontrados. Puedes revisarlos y modificarlos antes de guardar.'
            : 'No se encontró información para este documento. Completa los datos manualmente.',
        )
      } catch (error) {
        setLookupError(
          getApiErrorMessage(
            error,
            'No se pudo consultar el documento. Intenta nuevamente.',
          ),
        )
      } finally {
        setIsLookingUpNit(false)
      }
    },
    [isLookingUpNit],
  )

  const handleAutocompletar = () => {
    void handleLookupDocument(form.document_type, form.document_number)
  }

  const handleClose = () => {
    if (isSaving || isLookingUpNit) return
    onClose()
  }

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSaving(true)
    setErrorMessage(null)

    try {
      const payload: CreateJarvisTerceroRequest = {
        document_type: form.document_type,
        document_number: form.document_number.trim(),
        name: form.name.trim(),
        ...(form.check_digit?.trim()
          ? { check_digit: form.check_digit.trim() }
          : {}),
        ...(form.entity_type ? { entity_type: form.entity_type } : {}),
        ...(form.tax_regime ? { tax_regime: form.tax_regime } : {}),
        ...(form.email?.trim() ? { email: form.email.trim() } : {}),
        ...(form.phone?.trim() ? { phone: form.phone.trim() } : {}),
        ...(form.address?.trim() ? { address: form.address.trim() } : {}),
      }

      const response = await createJarvisTercero(payload)
      const documentId = resumeDocumentId?.trim()
      if (documentId) {
        await resumeElectronicDocument(documentId, 'JARVIS')
      }

      onCreated?.(response.tercero)
      onClose()
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'No se pudo crear el tercero.'))
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOpen) {
    return null
  }

  return (
    <div className="modal-overlay" role="presentation" onClick={handleClose}>
      <div
        className="modal-dialog terceros-page__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="crear-tercero-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="crear-tercero-title" className="modal-dialog__title">
          Crear tercero
        </h2>

        {errorMessage && <ErrorMessage message={errorMessage} />}

        <form onSubmit={handleCreate}>
          <div className="terceros-page__form-grid">
            <div className="terceros-page__field">
              <label htmlFor="tercero-document-type">Tipo de documento</label>
              <select
                id="tercero-document-type"
                value={form.document_type}
                onChange={(event) => {
                  const nextType = event.target.value as JarvisDocumentType
                  setForm((current) => ({
                    ...current,
                    document_type: nextType,
                  }))
                  setLookupMessage(null)
                  setLookupError(null)
                }}
                disabled={isSaving || isLookingUpNit}
                required
              >
                {JARVIS_DOCUMENT_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="terceros-page__field">
              <label htmlFor="tercero-document-number">
                Número de documento
              </label>
              <div className="terceros-page__document-row">
                <input
                  id="tercero-document-number"
                  type="text"
                  inputMode="numeric"
                  value={form.document_number}
                  onChange={(event) => {
                    setForm((current) => ({
                      ...current,
                      document_number: event.target.value,
                    }))
                    setLookupMessage(null)
                    setLookupError(null)
                  }}
                  disabled={isSaving || isLookingUpNit}
                  required
                />
                <button
                  type="button"
                  className="terceros-page__autocomplete-btn"
                  onClick={handleAutocompletar}
                  disabled={
                    isSaving ||
                    isLookingUpNit ||
                    form.document_number.trim().length < 5
                  }
                >
                  {isLookingUpNit ? 'Consultando...' : 'Autocompletar'}
                </button>
              </div>
            </div>

            {(lookupMessage || lookupError || isLookingUpNit) && (
              <p
                className={`terceros-page__lookup-feedback ${
                  lookupError
                    ? 'terceros-page__lookup-feedback--error'
                    : 'terceros-page__lookup-feedback--success'
                }`}
              >
                {isLookingUpNit
                  ? 'Consultando información...'
                  : (lookupError ?? lookupMessage)}
              </p>
            )}

            <div className="terceros-page__field">
              <label htmlFor="tercero-check-digit">
                Dígito de verificación
              </label>
              <input
                id="tercero-check-digit"
                type="text"
                value={form.check_digit ?? ''}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    check_digit: event.target.value,
                  }))
                }
                disabled={isSaving || isLookingUpNit}
                maxLength={2}
              />
            </div>

            <div className="terceros-page__field terceros-page__field--full">
              <label htmlFor="tercero-name">Nombre / razón social</label>
              <input
                id="tercero-name"
                type="text"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                disabled={isSaving || isLookingUpNit}
                required
              />
            </div>

            <div className="terceros-page__field">
              <label htmlFor="tercero-entity-type">Persona o empresa</label>
              <select
                id="tercero-entity-type"
                value={form.entity_type ?? ''}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    entity_type: (event.target.value || undefined) as
                      | JarvisEntityType
                      | undefined,
                  }))
                }
                disabled={isSaving || isLookingUpNit}
              >
                <option value="">Sin especificar</option>
                {JARVIS_ENTITY_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="terceros-page__field">
              <label htmlFor="tercero-tax-regime">Régimen</label>
              <select
                id="tercero-tax-regime"
                value={form.tax_regime ?? ''}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    tax_regime: (event.target.value || undefined) as
                      | JarvisTaxRegime
                      | undefined,
                  }))
                }
                disabled={isSaving || isLookingUpNit}
              >
                <option value="">Sin especificar</option>
                {JARVIS_TAX_REGIME_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="terceros-page__field">
              <label htmlFor="tercero-email">Correo</label>
              <input
                id="tercero-email"
                type="email"
                value={form.email ?? ''}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
                disabled={isSaving || isLookingUpNit}
              />
            </div>

            <div className="terceros-page__field">
              <label htmlFor="tercero-phone">Teléfono</label>
              <input
                id="tercero-phone"
                type="tel"
                value={form.phone ?? ''}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    phone: event.target.value,
                  }))
                }
                disabled={isSaving || isLookingUpNit}
              />
            </div>

            <div className="terceros-page__field terceros-page__field--full">
              <label htmlFor="tercero-address">Dirección</label>
              <input
                id="tercero-address"
                type="text"
                value={form.address ?? ''}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    address: event.target.value,
                  }))
                }
                disabled={isSaving || isLookingUpNit}
              />
            </div>
          </div>

          <div className="modal-dialog__actions">
            <button
              type="button"
              className="modal-dialog__button modal-dialog__button--secondary"
              onClick={handleClose}
              disabled={isSaving || isLookingUpNit}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="modal-dialog__button modal-dialog__button--primary"
              disabled={isSaving || isLookingUpNit}
            >
              {isSaving ? 'Guardando...' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CreateJarvisTerceroModal
