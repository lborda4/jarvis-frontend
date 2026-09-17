import { type FormEvent, useEffect, useRef, useState } from 'react'
import Autocomplete from './Autocomplete'
import Button from './Button'
import ErrorMessage from './ErrorMessage'
import Modal from './Modal'
import { getApiErrorMessage } from '../services/apiClient'
import { resumeElectronicDocument } from '../services/electronicDocumentService'
import {
  createJarvisTercero,
  fetchTerceroCountries,
  fetchTerceroMunicipalities,
  updateJarvisTercero,
} from '../services/jarvisService'
import { createSiigoSupplier } from '../services/siigoService'
import {
  JARVIS_CLIENT_TYPE_OPTIONS,
  JARVIS_DOCUMENT_TYPE,
  JARVIS_DOCUMENT_TYPE_OPTIONS,
  JARVIS_ENTITY_TYPE,
  JARVIS_FISCAL_REGIME,
  JARVIS_FISCAL_REGIME_OPTIONS,
  JARVIS_VAT_REGIME,
  JARVIS_VAT_REGIME_OPTIONS,
  JARVIS_ENTITY_TYPE_OPTIONS,
  type CreateJarvisTerceroRequest,
  type JarvisCatalogOption,
  type JarvisClientType,
  type JarvisDocumentType,
  type JarvisEntityType,
  type JarvisFiscalRegime,
  type JarvisTercero,
  type JarvisVatRegime,
} from '../types/jarvis'
import type { SiigoSupplierPersonType } from '../types/siigo'
import { inferSiigoSupplierIdentity } from '../utils/inferSiigoSupplierIdentity'
import '../pages/TercerosPage.css'
import '../pages/InvoiceUpload.css'

const DEFAULT_COUNTRY = 'Colombia'

function createEmptyForm(): CreateJarvisTerceroRequest {
  return {
    document_type: JARVIS_DOCUMENT_TYPE.NIT,
    document_number: '',
    name: '',
    check_digit: '',
    fiscal_regime: JARVIS_FISCAL_REGIME.ORDINARY,
    vat_regime: JARVIS_VAT_REGIME.RESPONSIBLE,
    economic_activity: '',
    email: '',
    phone: '',
    address: '',
    country: DEFAULT_COUNTRY,
    city: '',
    city_code: '',
  }
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
  /** Si se indica, el modal entra en modo edición sobre este tercero. */
  terceroToEdit?: JarvisTercero | null
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
  terceroToEdit,
  onCreated,
}: CreateJarvisTerceroModalProps) {
  const isEditing = Boolean(terceroToEdit)
  const [form, setForm] = useState<CreateJarvisTerceroRequest>(createEmptyForm)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [countries, setCountries] = useState<JarvisCatalogOption[]>([])
  const [municipalities, setMunicipalities] = useState<JarvisCatalogOption[]>([])
  const openedKeyRef = useRef<string | null>(null)

  // Catálogos de país y municipio (tablas maestras de NextPyme). Se cargan una
  // vez al abrir el modal; si fallan, los selectores quedan vacíos pero el
  // resto del formulario sigue funcionando.
  useEffect(() => {
    if (!isOpen) return

    let active = true

    fetchTerceroCountries()
      .then((items) => {
        if (active) setCountries(items)
      })
      .catch(() => {
        /* Silencioso: el selector queda vacío. */
      })

    fetchTerceroMunicipalities()
      .then((items) => {
        if (active) setMunicipalities(items)
      })
      .catch(() => {
        /* Silencioso. */
      })

    return () => {
      active = false
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) {
      openedKeyRef.current = null
      return
    }

    const openKey = `${terceroToEdit?.id ?? ''}|${initialDocumentType ?? ''}|${initialDocumentNumber ?? ''}|${resumeDocumentId ?? ''}`
    if (openedKeyRef.current === openKey) {
      return
    }

    openedKeyRef.current = openKey
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

    if (terceroToEdit) {
      setForm({
        document_type: resolveDocumentType(terceroToEdit.document_type),
        document_number: terceroToEdit.document_number,
        name: terceroToEdit.name,
        check_digit: terceroToEdit.check_digit ?? '',
        entity_type: terceroToEdit.entity_type ?? undefined,
        tax_regime: terceroToEdit.tax_regime ?? undefined,
        client_type: terceroToEdit.client_type ?? undefined,
        fiscal_regime: terceroToEdit.fiscal_regime ?? JARVIS_FISCAL_REGIME.ORDINARY,
        vat_regime: terceroToEdit.vat_regime ?? JARVIS_VAT_REGIME.RESPONSIBLE,
        economic_activity: terceroToEdit.economic_activity ?? '',
        email: terceroToEdit.email ?? '',
        phone: terceroToEdit.phone ?? '',
        address: terceroToEdit.address ?? '',
        country: terceroToEdit.country ?? DEFAULT_COUNTRY,
        city: terceroToEdit.city ?? '',
        city_code: terceroToEdit.city_code ?? '',
      })
    } else {
      setForm({
        ...createEmptyForm(),
        document_type: resolveDocumentType(initialDocumentType),
        document_number: initialDocumentNumber?.trim() || '',
      })
    }

    setErrorMessage(null)
  }, [
    isOpen,
    initialDocumentType,
    initialDocumentNumber,
    resumeDocumentId,
    terceroToEdit,
  ])
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
    if (isSaving) return
    onClose()
  }

  const selectedCountry =
    countries.find((option) => option.name === form.country) ??
    (form.country ? { code: null, name: form.country } : null)

  const selectedCity =
    municipalities.find((option) =>
      form.city_code
        ? option.code === form.city_code
        : option.name === form.city,
    ) ?? (form.city ? { code: form.city_code ?? null, name: form.city } : null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
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
        ...(form.client_type ? { client_type: form.client_type } : {}),
        ...(form.fiscal_regime ? { fiscal_regime: form.fiscal_regime } : {}),
        ...(form.vat_regime ? { vat_regime: form.vat_regime } : {}),
        ...(form.economic_activity?.trim()
          ? { economic_activity: form.economic_activity.trim() }
          : {}),
        ...(form.email?.trim() ? { email: form.email.trim() } : {}),
        ...(form.phone?.trim() ? { phone: form.phone.trim() } : {}),
        ...(form.address?.trim() ? { address: form.address.trim() } : {}),
        ...(form.country?.trim() ? { country: form.country.trim() } : {}),
        ...(form.city?.trim() ? { city: form.city.trim() } : {}),
        ...(form.city_code?.trim() ? { city_code: form.city_code.trim() } : {}),
      }

      // Modo edición: solo JARVIS (SIIGO no edita desde aquí). Actualiza el
      // tercero existente y no toca tipo/número de documento.
      if (isEditing && terceroToEdit) {
        if (!payload.name) {
          throw new Error('La razón social es obligatoria.')
        }

        const response = await updateJarvisTercero(terceroToEdit.id, {
          name: payload.name,
          ...(payload.check_digit ? { check_digit: payload.check_digit } : {}),
          ...(payload.entity_type ? { entity_type: payload.entity_type } : {}),
          ...(payload.tax_regime ? { tax_regime: payload.tax_regime } : {}),
          ...(payload.client_type ? { client_type: payload.client_type } : {}),
          ...(payload.fiscal_regime
            ? { fiscal_regime: payload.fiscal_regime }
            : {}),
          ...(payload.vat_regime ? { vat_regime: payload.vat_regime } : {}),
          ...(payload.economic_activity
            ? { economic_activity: payload.economic_activity }
            : {}),
          ...(payload.email ? { email: payload.email } : {}),
          ...(payload.phone ? { phone: payload.phone } : {}),
          ...(payload.address ? { address: payload.address } : {}),
          ...(payload.country ? { country: payload.country } : {}),
          ...(payload.city ? { city: payload.city } : {}),
          ...(payload.city_code ? { city_code: payload.city_code } : {}),
        })

        onCreated?.(response.tercero)
        onClose()
        return
      }

      const documentId = resumeDocumentId?.trim()

      if (provider === 'SIIGO') {
        if (!documentId) {
          throw new Error(
            'No se encontró el documento soporte para crear el tercero en SIIGO.',
          )
        }

        if (!payload.name) {
          throw new Error('La razón social es obligatoria.')
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
          ...(payload.check_digit ? { check_digit: payload.check_digit } : {}),
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
          client_type: payload.client_type ?? null,
          fiscal_regime: payload.fiscal_regime ?? null,
          vat_regime: payload.vat_regime ?? null,
          economic_activity: payload.economic_activity ?? null,
          email: payload.email ?? null,
          phone: payload.phone ?? null,
          address: payload.address ?? null,
          country: payload.country ?? null,
          city: payload.city ?? null,
          city_code: payload.city_code ?? null,
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
      setErrorMessage(
        getApiErrorMessage(
          error,
          isEditing
            ? 'No se pudo actualizar el cliente.'
            : 'No se pudo crear el cliente.',
        ),
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      busy={isSaving}
      labelledBy="crear-tercero-title"
      className="terceros-page__dialog terceros-page__dialog--wide"
      size="lg"
    >
      <h2 id="crear-tercero-title" className="modal-dialog__title">
        {isEditing ? 'Editar cliente' : 'Crear cliente'}
      </h2>
      <p className="tercero-modal__subtitle">
        Registra la información del cliente. Solo la información esencial.
      </p>

      {errorMessage && <ErrorMessage message={errorMessage} />}

      <form onSubmit={handleSubmit}>
        {/* ---- Información básica ---- */}
        <section className="tercero-modal__section">
          <h3 className="tercero-modal__section-title">Información básica</h3>

          <div className="terceros-page__form-grid">
            <div className="terceros-page__field terceros-page__field--full">
              <div className="tercero-modal__id-row">
                <div className="tercero-modal__id-cell tercero-modal__id-cell--type">
                  <label htmlFor="tercero-document-type">
                    Tipo de identificación *
                  </label>
                  <select
                    id="tercero-document-type"
                    value={form.document_type}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        document_type: event.target.value as JarvisDocumentType,
                      }))
                    }
                    disabled={isSaving || isEditing}
                    required
                  >
                    {JARVIS_DOCUMENT_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="tercero-modal__id-cell tercero-modal__id-cell--number">
                  <label htmlFor="tercero-document-number">
                    Número de identificación *
                  </label>
                  <input
                    id="tercero-document-number"
                    type="text"
                    inputMode="numeric"
                    value={form.document_number}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        document_number: event.target.value,
                      }))
                    }
                    disabled={isSaving || isEditing}
                    required
                  />
                </div>

                <div className="tercero-modal__id-cell tercero-modal__id-cell--dv">
                  <label htmlFor="tercero-check-digit">DV</label>
                  <input
                    id="tercero-check-digit"
                    type="text"
                    inputMode="numeric"
                    value={form.check_digit ?? ''}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        check_digit: event.target.value,
                      }))
                    }
                    disabled={isSaving || isEditing}
                    maxLength={2}
                  />
                </div>

                {/* El botón de validar en la DIAN aún no tiene funcionalidad. */}
                <div className="tercero-modal__id-cell tercero-modal__id-cell--action">
                  <Button
                    variant="outline"
                    type="button"
                    className="tercero-modal__validate-btn"
                    disabled
                  >
                    Validar en la DIAN
                  </Button>
                </div>
              </div>
            </div>

            <div className="terceros-page__field terceros-page__field--full">
              <label htmlFor="tercero-name">Razón social *</label>
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
                disabled={isSaving}
                required
              />
            </div>

            <div className="terceros-page__field">
              <label htmlFor="tercero-fiscal-regime">Régimen fiscal *</label>
              <select
                id="tercero-fiscal-regime"
                value={form.fiscal_regime ?? JARVIS_FISCAL_REGIME.ORDINARY}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    fiscal_regime: event.target.value as JarvisFiscalRegime,
                  }))
                }
                disabled={isSaving}
                required
              >
                {JARVIS_FISCAL_REGIME_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="terceros-page__field">
              <label htmlFor="tercero-vat-regime">Responsabilidad IVA *</label>
              <select
                id="tercero-vat-regime"
                value={form.vat_regime ?? JARVIS_VAT_REGIME.RESPONSIBLE}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    vat_regime: event.target.value as JarvisVatRegime,
                  }))
                }
                disabled={isSaving}
                required
              >
                {JARVIS_VAT_REGIME_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="terceros-page__field">
              <label htmlFor="tercero-economic-activity">
                Actividad económica principal (CIIU)
              </label>
              <input
                id="tercero-economic-activity"
                type="text"
                value={form.economic_activity ?? ''}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    economic_activity: event.target.value,
                  }))
                }
                placeholder="4649 - Comercio al por mayor..."
                disabled={isSaving}
              />
            </div>

            <div className="terceros-page__field">
              <label>Ciudad / Municipio</label>
              <Autocomplete<JarvisCatalogOption>
                value={selectedCity}
                onChange={(option) =>
                  setForm((current) => ({
                    ...current,
                    city: option?.name ?? '',
                    city_code: option?.code ?? '',
                  }))
                }
                options={municipalities}
                placeholder="Buscar municipio..."
                emptyMessage="No se encontraron municipios"
                getOptionKey={(option) => option.code ?? option.name}
                getOptionLabel={(option) =>
                  option.code ? `${option.code} - ${option.name}` : option.name
                }
                isOptionMatch={(option, query) =>
                  `${option.code ?? ''} ${option.name}`
                    .toLowerCase()
                    .includes(query)
                }
              />
            </div>

            <div className="terceros-page__field">
              <label htmlFor="tercero-client-type">Tipo de cliente</label>
              <select
                id="tercero-client-type"
                value={form.client_type ?? ''}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    client_type: (event.target.value || undefined) as
                      | JarvisClientType
                      | undefined,
                  }))
                }
                disabled={isSaving}
              >
                <option value="">Sin especificar</option>
                {JARVIS_CLIENT_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* ---- Información de contacto ---- */}
        <section className="tercero-modal__section">
          <h3 className="tercero-modal__section-title">
            Información de contacto
          </h3>

          <div className="terceros-page__form-grid">
            <div className="terceros-page__field terceros-page__field--full">
              <label htmlFor="tercero-address">Dirección principal *</label>
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
                disabled={isSaving}
                required
              />
            </div>

            <div className="terceros-page__field">
              <label>País *</label>
              <Autocomplete<JarvisCatalogOption>
                value={selectedCountry}
                onChange={(option) =>
                  setForm((current) => ({
                    ...current,
                    country: option?.name ?? '',
                  }))
                }
                options={countries}
                placeholder="Buscar país..."
                emptyMessage="No se encontraron países"
                getOptionKey={(option) => option.code ?? option.name}
                getOptionLabel={(option) => option.name}
                isOptionMatch={(option, query) =>
                  option.name.toLowerCase().includes(query)
                }
              />
            </div>

            <div className="terceros-page__field">
              <label htmlFor="tercero-phone">Teléfono principal *</label>
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
                disabled={isSaving}
                required
              />
            </div>

            <div className="terceros-page__field">
              <label htmlFor="tercero-email">Correo electrónico *</label>
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
                disabled={isSaving}
                required
              />
            </div>
          </div>
        </section>

        <div className="modal-dialog__actions">
          <Button
            variant="secondary"
            onClick={handleClose}
            disabled={isSaving}
          >
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={isSaving}>
            {isSaving
              ? 'Guardando...'
              : isEditing
                ? 'Guardar'
                : 'Crear cliente'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default CreateJarvisTerceroModal
