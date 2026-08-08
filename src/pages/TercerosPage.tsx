import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import CreateJarvisTerceroModal from '../components/CreateJarvisTerceroModal'
import ErrorMessage from '../components/ErrorMessage'
import LoadingIndicator from '../components/LoadingIndicator'
import SuccessMessage from '../components/SuccessMessage'
import { getApiErrorMessage } from '../services/apiClient'
import { fetchJarvisTerceros } from '../services/jarvisService'
import {
  JARVIS_DOCUMENT_TYPE,
  JARVIS_DOCUMENT_TYPE_OPTIONS,
  JARVIS_ENTITY_TYPE_OPTIONS,
  JARVIS_TAX_REGIME_OPTIONS,
  type JarvisDocumentType,
  type JarvisEntityType,
  type JarvisTaxRegime,
  type JarvisTercero,
} from '../types/jarvis'
import './TercerosPage.css'
import './InvoiceUpload.css'

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
  const [searchParams, setSearchParams] = useSearchParams()
  const initialQueryHandledRef = useRef(false)
  const [items, setItems] = useState<JarvisTercero[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [createDocumentType, setCreateDocumentType] = useState<string>(
    JARVIS_DOCUMENT_TYPE.NIT,
  )
  const [createDocumentNumber, setCreateDocumentNumber] = useState('')
  const [resumeDocumentId, setResumeDocumentId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

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

    setCreateDocumentType(documentType)
    setCreateDocumentNumber(searchParams.get('document_number')?.trim() || '')
    setResumeDocumentId(searchParams.get('document_id')?.trim() || null)
    setIsCreateOpen(true)

    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('create')
    nextParams.delete('document_type')
    nextParams.delete('document_number')
    nextParams.delete('document_id')
    nextParams.delete('return_to')
    setSearchParams(nextParams, { replace: true })
  }, [searchParams, setSearchParams])

  const openCreate = () => {
    setSuccessMessage(null)
    setErrorMessage(null)
    setCreateDocumentType(JARVIS_DOCUMENT_TYPE.NIT)
    setCreateDocumentNumber('')
    setResumeDocumentId(null)
    setIsCreateOpen(true)
  }

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void loadTerceros(search)
  }

  const handleCreated = (tercero: JarvisTercero) => {
    setSuccessMessage(`Tercero "${tercero.name}" creado correctamente.`)
    setIsCreateOpen(false)
    setResumeDocumentId(null)
    void loadTerceros(search)
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

      <CreateJarvisTerceroModal
        isOpen={isCreateOpen}
        onClose={() => {
          setIsCreateOpen(false)
          setResumeDocumentId(null)
        }}
        initialDocumentType={createDocumentType}
        initialDocumentNumber={createDocumentNumber}
        resumeDocumentId={resumeDocumentId}
        onCreated={handleCreated}
      />
    </main>
  )
}

export default TercerosPage
