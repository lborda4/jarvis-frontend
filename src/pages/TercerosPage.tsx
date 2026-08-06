import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import ErrorMessage from '../components/ErrorMessage'
import LoadingIndicator from '../components/LoadingIndicator'
import SuccessMessage from '../components/SuccessMessage'
import { getApiErrorMessage } from '../services/apiClient'
import { resumeElectronicDocument } from '../services/electronicDocumentService'
import {
  createJarvisTercero,
  fetchJarvisTerceros,
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
import './TercerosPage.css'
import './InvoiceUpload.css'

const EMPTY_FORM: CreateJarvisTerceroRequest = {
  document_type: JARVIS_DOCUMENT_TYPE.NIT,
  document_number: '',
  name: '',
  check_digit: '',
  email: '',
  phone: '',
  address: '',
}

function formatEntityType(value: JarvisEntityType | null): string {
  if (!value) return '—'
  return (
    JARVIS_ENTITY_TYPE_OPTIONS.find((option) => option.value === value)?.label ??
    value
  )
}

function formatTaxRegime(value: JarvisTaxRegime | null): string {
  if (!value) return '—'
  return (
    JARVIS_TAX_REGIME_OPTIONS.find((option) => option.value === value)?.label ??
    value
  )
}

function TercerosPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialQueryHandledRef = useRef(false)
  const [items, setItems] = useState<JarvisTercero[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isLookingUpNit, setIsLookingUpNit] = useState(false)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [form, setForm] = useState<CreateJarvisTerceroRequest>(EMPTY_FORM)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [lookupMessage, setLookupMessage] = useState<string | null>(null)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const lastLookupKeyRef = useRef<string | null>(null)

  const loadTerceros = useCallback(async (query?: string) => {
    setIsLoading(true)
    setErrorMessage(null)

    try {
      const response = await fetchJarvisTerceros(query)
      setItems(response.items)
      setTotal(response.total)
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(error, 'No se pudieron cargar los terceros.'),
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadTerceros()
  }, [loadTerceros])

  useEffect(() => {
    if (
      initialQueryHandledRef.current ||
      searchParams.get('create') !== '1'
    ) {
      return
    }

    initialQueryHandledRef.current = true
    const requestedType = searchParams.get('document_type')
    const documentType = JARVIS_DOCUMENT_TYPE_OPTIONS.some(
      (option) => option.value === requestedType,
    )
      ? (requestedType as JarvisDocumentType)
      : JARVIS_DOCUMENT_TYPE.NIT

    setForm({
      ...EMPTY_FORM,
      document_type: documentType,
      document_number: searchParams.get('document_number')?.trim() || '',
    })
    setIsCreateOpen(true)
  }, [searchParams])

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void loadTerceros(search)
  }

  const openCreate = () => {
    setForm(EMPTY_FORM)
    setSuccessMessage(null)
    setErrorMessage(null)
    setLookupMessage(null)
    setLookupError(null)
    lastLookupKeyRef.current = null
    setIsCreateOpen(true)
  }

  const closeCreate = () => {
    if (isSaving || isLookingUpNit) return
    setIsCreateOpen(false)
  }

  const handleLookupDocument = useCallback(
    async (documentType: JarvisDocumentType, rawDocumentValue: string) => {
      const [rawDocumentNumber, rawCheckDigit] = rawDocumentValue.split('-')
      const documentNumber = rawDocumentNumber.replace(/\D/g, '')
      const typedCheckDigit = rawCheckDigit?.replace(/\D/g, '') ?? ''
      const lookupKey = `${documentType}:${documentNumber}`

      if (documentNumber.length < 5) {
        return
      }

      if (isLookingUpNit || lastLookupKeyRef.current === lookupKey) {
        return
      }

      lastLookupKeyRef.current = lookupKey
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
            : 'NextPyme no encontró información para este documento. Completa los datos manualmente.',
        )
      } catch (error) {
        lastLookupKeyRef.current = null
        setLookupError(
          getApiErrorMessage(
            error,
            'No se pudo consultar el documento en NextPyme.',
          ),
        )
      } finally {
        setIsLookingUpNit(false)
      }
    },
    [isLookingUpNit],
  )

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSaving(true)
    setErrorMessage(null)
    setSuccessMessage(null)

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
      setSuccessMessage(
        `Tercero "${response.tercero.name}" creado correctamente.`,
      )
      setIsCreateOpen(false)
      setForm(EMPTY_FORM)
      await loadTerceros(search)

      const documentId = searchParams.get('document_id')?.trim()
      if (documentId) {
        await resumeElectronicDocument(documentId, 'JARVIS')
      }

      const returnTo = searchParams.get('return_to')?.trim()
      if (returnTo?.startsWith('/')) {
        navigate(returnTo)
      }
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'No se pudo crear el tercero.'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="terceros-page">
      <header className="terceros-page__header">
        <div>
          <h1>Terceros</h1>
          <p>Consulta y crea los terceros de tu empresa Jarvis.</p>
        </div>
        <button
          type="button"
          className="terceros-page__create-btn"
          onClick={openCreate}
        >
          Crear
        </button>
      </header>

      {errorMessage && <ErrorMessage message={errorMessage} />}
      {successMessage && <SuccessMessage message={successMessage} />}

      <form className="terceros-page__search" onSubmit={handleSearch}>
        <label htmlFor="terceros-search">Buscar</label>
        <div className="terceros-page__search-row">
          <input
            id="terceros-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nombre o documento"
          />
          <button type="submit" disabled={isLoading}>
            Buscar
          </button>
        </div>
      </form>

      <section className="terceros-page__list" aria-live="polite">
        <div className="terceros-page__list-header">
          <h2>Lista de terceros</h2>
          <p>
            {total} {total === 1 ? 'tercero' : 'terceros'}
          </p>
        </div>

        {isLoading ? (
          <LoadingIndicator message="Cargando terceros..." />
        ) : items.length === 0 ? (
          <div className="terceros-page__empty">
            <p>Aún no hay terceros creados.</p>
            <button type="button" onClick={openCreate}>
              Crear el primero
            </button>
          </div>
        ) : (
          <div className="terceros-page__table-wrap">
            <table className="terceros-page__table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Documento</th>
                  <th>Tipo</th>
                  <th>Régimen</th>
                  <th>Contacto</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.name}</strong>
                      {item.address ? (
                        <span className="terceros-page__muted">{item.address}</span>
                      ) : null}
                    </td>
                    <td>
                      {item.document_type} {item.document_number}
                      {item.check_digit ? `-${item.check_digit}` : ''}
                    </td>
                    <td>{formatEntityType(item.entity_type)}</td>
                    <td>{formatTaxRegime(item.tax_regime)}</td>
                    <td>
                      {item.email || item.phone ? (
                        <>
                          {item.email ? <span>{item.email}</span> : null}
                          {item.phone ? (
                            <span className="terceros-page__muted">{item.phone}</span>
                          ) : null}
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {isCreateOpen && (
        <div className="modal-overlay" role="presentation" onClick={closeCreate}>
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
                      lastLookupKeyRef.current = null
                      void handleLookupDocument(nextType, form.document_number)
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
                      lastLookupKeyRef.current = null
                    }}
                    onBlur={(event) => {
                      void handleLookupDocument(
                        form.document_type,
                        event.target.value,
                      )
                    }}
                    disabled={isSaving || isLookingUpNit}
                    required
                  />
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
                      ? 'Consultando información en NextPyme...'
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
                  onClick={closeCreate}
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
      )}
    </main>
  )
}

export default TercerosPage
