import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import Button from './Button'
import ErrorMessage from './ErrorMessage'
import Modal from './Modal'
import { getApiErrorMessage } from '../services/apiClient'
import { resumeElectronicDocument } from '../services/electronicDocumentService'
import {
  createJarvisTercero,
  lookupJarvisTerceroByNit,
} from '../services/jarvisService'
import { createSiigoSupplier } from '../services/siigoService'
import {
  JARVIS_DOCUMENT_TYPE,
  JARVIS_DOCUMENT_TYPE_OPTIONS,
  JARVIS_ENTITY_TYPE,
  JARVIS_ENTITY_TYPE_OPTIONS,
  type CreateJarvisTerceroRequest,
  type JarvisDocumentType,
  type JarvisEntityType,
  type JarvisTercero,
} from '../types/jarvis'
import type { SiigoSupplierPersonType } from '../types/siigo'
import { inferSiigoSupplierIdentity } from '../utils/inferSiigoSupplierIdentity'
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

export type CreateTerceroModalProvider = 'JARVIS' | 'SIIGO'

export interface CreateJarvisTerceroModalProps {
  isOpen: boolean
  onClose: () => void
  initialDocumentType?: string | null
  initialDocumentNumber?: string | null
  /** Si se indica, reanuda la preparación del documento soporte tras crear el tercero. */
  resumeDocumentId?: string | null
  /** JARVIS guarda en jarvis_terceros; SIIGO crea el cliente en SIIGO. */
  provider?: CreateTerceroModalProvider
  onCreated?: (tercero: JarvisTercero) => void
}

function resolveDocumentType(value?: string | null): JarvisDocumentType {
  return JARVIS_DOCUMENT_TYPE_OPTIONS.some((option) => option.value === value)
    ? (value as JarvisDocumentType)
    : JARVIS_DOCUMENT_TYPE.NIT
}

function resolveSiigoPersonType(
  entityType: JarvisEntityType | undefined,
  documentNumber: string,
): SiigoSupplierPersonType {
  if (entityType === JARVIS_ENTITY_TYPE.NATURAL_PERSON) {
    return 'person'
  }

  if (entityType === JARVIS_ENTITY_TYPE.LEGAL_ENTITY) {
    return 'company'
  }

  return inferSiigoSupplierIdentity(documentNumber).personType
}

function CreateJarvisTerceroModal({
  isOpen,
  onClose,
  initialDocumentType,
  initialDocumentNumber,
  resumeDocumentId,
  provider = 'JARVIS',
  onCreated,
}: CreateJarvisTerceroModalProps) {
  const [form, setForm] = useState<CreateJarvisTerceroRequest>(EMPTY_FORM)
  const [isSaving, setIsSaving] = useState(false)
  const [isLookingUpNit, setIsLookingUpNit] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [lookupMessage, setLookupMessage] = useState<string | null>(null)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const openedKeyRef = useRef<string | null>(null)

  const handleLookupDocument = useCallback(
    async (documentType: JarvisDocumentType, rawDocumentValue: string) => {
      const [rawDocumentNumber, rawCheckDigit] = rawDocumentValue.split('-')
      const documentNumber = rawDocumentNumber.replace(/\D/g, '')
      const typedCheckDigit = rawCheckDigit?.replace(/\D/g, '') ?? ''

      if (documentNumber.length < 5) {
        setLookupError(
          'El número de documento debe tener al menos 5 dígitos para poder buscarlo.',
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
    const documentType = resolveDocumentType(initialDocumentType)
    const documentNumber = initialDocumentNumber?.trim() || ''
    setForm({
      ...EMPTY_FORM,
      document_type: documentType,
      document_number: documentNumber,
    })
    setErrorMessage(null)
    setLookupMessage(null)
    setLookupError(null)

    // Ya no hay botón "Autocompletar": la consulta a NextPyme (vía
    // lookup-nit) se dispara sola apenas se abre el modal, para que el
    // usuario vea los datos ya llenos en vez de tener que pedirlos a mano.
    if (documentNumber) {
      void handleLookupDocument(documentType, documentNumber)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialDocumentType, initialDocumentNumber, resumeDocumentId])

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

      const documentId = resumeDocumentId?.trim()

      if (provider === 'SIIGO') {
        if (!documentId) {
          throw new Error(
            'No se encontró el documento soporte para crear el tercero en SIIGO.',
          )
        }

        if (!payload.name) {
          throw new Error('El nombre / razón social es obligatorio.')
        }

        if (!payload.entity_type) {
          throw new Error(
            'Indica si es persona natural o jurídica para crear el tercero en SIIGO.',
          )
        }

        await createSiigoSupplier({
          documentId,
          person_type: resolveSiigoPersonType(
            payload.entity_type,
            payload.document_number,
          ),
          name: payload.name,
          document_type: payload.document_type,
          document_number: payload.document_number,
          ...(payload.check_digit
            ? { check_digit: payload.check_digit }
            : {}),
          ...(payload.email ? { email: payload.email } : {}),
          ...(payload.phone ? { phone: payload.phone } : {}),
          ...(payload.address ? { address: payload.address } : {}),
        })

        await resumeElectronicDocument(documentId, 'SIIGO')

        const now = new Date().toISOString()
        onCreated?.({
          id: documentId,
          document_type: payload.document_type,
          document_number: payload.document_number,
          check_digit: payload.check_digit ?? null,
          name: payload.name,
          entity_type: payload.entity_type ?? null,
          tax_regime: payload.tax_regime ?? null,
          email: payload.email ?? null,
          phone: payload.phone ?? null,
          address: payload.address ?? null,
          created_at: now,
          updated_at: now,
        })
        onClose()
        return
      }

      const response = await createJarvisTercero(payload)
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      busy={isSaving || isLookingUpNit}
      labelledBy="crear-tercero-title"
      className="terceros-page__dialog"
    >
      <h2 id="crear-tercero-title" className="modal-dialog__title">
        {provider === 'SIIGO' ? 'Crear tercero en SIIGO' : 'Crear tercero'}
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
                  // Cuando se abre "en blanco" (crear uno nuevo desde el
                  // listado, sin documento precargado) la búsqueda a
                  // NextPyme solo se disparaba al ABRIR el modal — si el
                  // usuario tipeaba el número a mano, nunca se llamaba al
                  // mismo lookup que ya reutiliza el flujo de "Requiere
                  // proveedor" (bug real reportado). Se reusa el mismo
                  // handleLookupDocument al salir del campo.
                  onBlur={(event) => {
                    const value = event.target.value.trim()
                    if (value) {
                      void handleLookupDocument(form.document_type, value)
                    }
                  }}
                  disabled={isSaving || isLookingUpNit}
                  required
                />
                <input
                  id="tercero-check-digit"
                  className="terceros-page__check-digit-input"
                  type="text"
                  inputMode="numeric"
                  placeholder="DV"
                  aria-label="Dígito de verificación"
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
                  ? 'Buscando información...'
                  : (lookupError ?? lookupMessage)}
              </p>
            )}

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
                required={provider === 'SIIGO'}
              >
                <option value="">
                  {provider === 'SIIGO'
                    ? 'Seleccione una opción'
                    : 'Sin especificar'}
                </option>
                {JARVIS_ENTITY_TYPE_OPTIONS.map((option) => (
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
            <Button
              variant="secondary"
              onClick={handleClose}
              disabled={isSaving || isLookingUpNit}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={isSaving || isLookingUpNit}>
              {isSaving ? 'Guardando...' : 'Crear'}
            </Button>
          </div>
        </form>
    </Modal>
  )
}

export default CreateJarvisTerceroModal
