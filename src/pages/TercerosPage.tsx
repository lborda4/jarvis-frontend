import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useSearchParams } from 'react-router-dom'
import Button from '../components/Button'
import CreateJarvisTerceroModal from '../components/CreateJarvisTerceroModal'
import ErrorMessage from '../components/ErrorMessage'
import LoadingIndicator from '../components/LoadingIndicator'
import PageHeader from '../components/PageHeader'
import SuccessMessage from '../components/SuccessMessage'
import { getApiErrorMessage } from '../services/apiClient'
import { fetchJarvisTerceros } from '../services/jarvisService'
import { companyQueryKey, peekCachedQuery } from '../services/queryCache'
import {
  JARVIS_CLIENT_TYPE_OPTIONS,
  JARVIS_DOCUMENT_TYPE,
  JARVIS_DOCUMENT_TYPE_OPTIONS,
  type JarvisDocumentType,
  type JarvisTercero,
  type JarvisTercerosListResponse,
} from '../types/jarvis'
import './TercerosPage.css'
import './InvoiceUpload.css'

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const

function formatDocumentType(value: string): string {
  return (
    JARVIS_DOCUMENT_TYPE_OPTIONS.find((option) => option.value === value)
      ?.label ?? value
  )
}

function TercerosPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialQueryHandledRef = useRef(false)

  const cachedList = peekCachedQuery<JarvisTercerosListResponse>(
    companyQueryKey(['jarvis', 'terceros']),
  )

  const [items, setItems] = useState<JarvisTercero[]>(
    () => cachedList?.items ?? [],
  )
  const [total, setTotal] = useState(() => cachedList?.total ?? 0)
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(!cachedList)

  // Filtros (client-side sobre lo que trajo el backend).
  const [documentTypeFilter, setDocumentTypeFilter] = useState<string>('all')
  const [clientTypeFilter, setClientTypeFilter] = useState<string>('all')
  const [cityFilter, setCityFilter] = useState<string>('all')

  // Paginación (client-side).
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_OPTIONS[0])
  const [page, setPage] = useState(1)

  // Modal (crear / editar).
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [terceroToEdit, setTerceroToEdit] = useState<JarvisTercero | null>(null)
  const [createDocumentType, setCreateDocumentType] = useState<string>(
    JARVIS_DOCUMENT_TYPE.NIT,
  )
  const [createDocumentNumber, setCreateDocumentNumber] = useState('')
  const [resumeDocumentId, setResumeDocumentId] = useState<string | null>(null)

  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const loadTerceros = useCallback(async (query?: string) => {
    const trimmed = query?.trim()
    try {
      const response = await fetchJarvisTerceros(trimmed)
      setItems(response.items)
      setTotal(response.total)
      setErrorMessage(null)
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

  const runSearch = (query?: string) => {
    setIsLoading(true)
    void loadTerceros(query)
  }

  useEffect(() => {
    if (initialQueryHandledRef.current || searchParams.get('create') !== '1') {
      return
    }

    initialQueryHandledRef.current = true
    const requestedType = searchParams.get('document_type')
    const documentType = JARVIS_DOCUMENT_TYPE_OPTIONS.some(
      (option) => option.value === requestedType,
    )
      ? (requestedType as JarvisDocumentType)
      : JARVIS_DOCUMENT_TYPE.NIT

    setTerceroToEdit(null)
    setCreateDocumentType(documentType)
    setCreateDocumentNumber(searchParams.get('document_number')?.trim() || '')
    setResumeDocumentId(searchParams.get('document_id')?.trim() || null)
    setIsModalOpen(true)

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
    setTerceroToEdit(null)
    setCreateDocumentType(JARVIS_DOCUMENT_TYPE.NIT)
    setCreateDocumentNumber('')
    setResumeDocumentId(null)
    setIsModalOpen(true)
  }

  const openEdit = (tercero: JarvisTercero) => {
    setSuccessMessage(null)
    setErrorMessage(null)
    setResumeDocumentId(null)
    setTerceroToEdit(tercero)
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setTerceroToEdit(null)
    setResumeDocumentId(null)
  }

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPage(1)
    runSearch(search)
  }

  const handleSaved = (tercero: JarvisTercero) => {
    setSuccessMessage(
      terceroToEdit
        ? `Tercero "${tercero.name}" actualizado correctamente.`
        : `Tercero "${tercero.name}" creado correctamente.`,
    )
    closeModal()
    runSearch(search)
  }

  const clearFilters = () => {
    setSearch('')
    setDocumentTypeFilter('all')
    setClientTypeFilter('all')
    setCityFilter('all')
    setPage(1)
    runSearch()
  }

  // Ciudades presentes en el resultado, para el filtro de ciudad.
  const cityOptions = useMemo(() => {
    const names = new Set<string>()
    for (const item of items) {
      if (item.city) names.add(item.city)
    }
    return [...names].sort((a, b) => a.localeCompare(b))
  }, [items])

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (
        documentTypeFilter !== 'all' &&
        item.document_type !== documentTypeFilter
      ) {
        return false
      }
      if (
        clientTypeFilter !== 'all' &&
        item.client_type !== clientTypeFilter
      ) {
        return false
      }
      if (cityFilter !== 'all' && item.city !== cityFilter) {
        return false
      }
      return true
    })
  }, [items, documentTypeFilter, clientTypeFilter, cityFilter])

  const filteredTotal = filteredItems.length
  const pageCount = Math.max(1, Math.ceil(filteredTotal / pageSize))

  // Si cambian filtros/tamaño y la página actual queda fuera de rango, corrige.
  useEffect(() => {
    if (page > pageCount) {
      setPage(pageCount)
    }
  }, [page, pageCount])

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredItems.slice(start, start + pageSize)
  }, [filteredItems, page, pageSize])

  const rangeStart = filteredTotal === 0 ? 0 : (page - 1) * pageSize + 1
  const rangeEnd = Math.min(page * pageSize, filteredTotal)

  const hasActiveFilters =
    search.trim() !== '' ||
    documentTypeFilter !== 'all' ||
    clientTypeFilter !== 'all' ||
    cityFilter !== 'all'

  return (
    <main className="terceros-page">
      <PageHeader
        title="Terceros"
        actions={
          <Button variant="primary" onClick={openCreate}>
            + Crear tercero
          </Button>
        }
      />

      {errorMessage && <ErrorMessage message={errorMessage} />}
      {successMessage && <SuccessMessage message={successMessage} />}

      <form className="terceros-filters" onSubmit={handleSearch}>
        <div className="terceros-filters__field terceros-filters__field--grow">
          <label htmlFor="terceros-search">Buscar</label>
          <div className="terceros-filters__search-row">
            <input
              id="terceros-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nombre, NIT o razón social..."
            />
            <Button type="submit" variant="primary" disabled={isLoading}>
              Buscar
            </Button>
          </div>
        </div>

        <div className="terceros-filters__field">
          <label htmlFor="terceros-document-type">Tipo de identificación</label>
          <select
            id="terceros-document-type"
            value={documentTypeFilter}
            onChange={(event) => {
              setDocumentTypeFilter(event.target.value)
              setPage(1)
            }}
          >
            <option value="all">Todos</option>
            {JARVIS_DOCUMENT_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="terceros-filters__field">
          <label htmlFor="terceros-client-type">Proveedor o cliente</label>
          <select
            id="terceros-client-type"
            value={clientTypeFilter}
            onChange={(event) => {
              setClientTypeFilter(event.target.value)
              setPage(1)
            }}
          >
            <option value="all">Todos</option>
            {JARVIS_CLIENT_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="terceros-filters__field">
          <label htmlFor="terceros-city">Ciudad</label>
          <select
            id="terceros-city"
            value={cityFilter}
            onChange={(event) => {
              setCityFilter(event.target.value)
              setPage(1)
            }}
          >
            <option value="all">Todas</option>
            {cityOptions.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </div>

        {hasActiveFilters && (
          <Button
            type="button"
            variant="outline"
            onClick={clearFilters}
            disabled={isLoading}
          >
            Limpiar filtros
          </Button>
        )}
      </form>

      <section className="terceros-page__list" aria-live="polite">
        {isLoading ? (
          <LoadingIndicator message="Cargando terceros..." />
        ) : total === 0 ? (
          <div className="terceros-page__empty">
            <p>Aún no hay terceros creados.</p>
            <Button variant="primary" onClick={openCreate}>
              Crear el primero
            </Button>
          </div>
        ) : filteredTotal === 0 ? (
          <div className="terceros-page__empty">
            <p>Ningún tercero coincide con los filtros.</p>
            <Button variant="outline" onClick={clearFilters}>
              Limpiar filtros
            </Button>
          </div>
        ) : (
          <>
            <div className="terceros-page__table-wrap">
              <table className="terceros-page__table">
                <thead>
                  <tr>
                    <th>Nombre / Razón social</th>
                    <th>Tipo de identificación</th>
                    <th>NIT / Identificación</th>
                    <th>Ciudad</th>
                    <th>Correo electrónico</th>
                    <th>Teléfono</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.name}</strong>
                      </td>
                      <td>{formatDocumentType(item.document_type)}</td>
                      <td>
                        {item.document_number}
                        {item.check_digit ? `-${item.check_digit}` : ''}
                      </td>
                      <td>{item.city ?? '—'}</td>
                      <td>{item.email ?? '—'}</td>
                      <td>{item.phone ?? '—'}</td>
                      <td>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEdit(item)}
                        >
                          Editar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="terceros-pagination">
              <span className="terceros-pagination__info">
                Mostrando {rangeStart} a {rangeEnd} de {filteredTotal} registros
              </span>

              <div className="terceros-pagination__controls">
                <label className="terceros-pagination__page-size">
                  Filas por página
                  <select
                    value={pageSize}
                    onChange={(event) => {
                      setPageSize(Number(event.target.value))
                      setPage(1)
                    }}
                  >
                    {PAGE_SIZE_OPTIONS.map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="terceros-pagination__pages">
                  <button
                    type="button"
                    className="terceros-pagination__nav"
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={page <= 1}
                    aria-label="Página anterior"
                  >
                    ‹
                  </button>

                  {Array.from({ length: pageCount }, (_, index) => index + 1).map(
                    (pageNumber) => (
                      <button
                        key={pageNumber}
                        type="button"
                        className={`terceros-pagination__page${
                          pageNumber === page
                            ? ' terceros-pagination__page--active'
                            : ''
                        }`}
                        onClick={() => setPage(pageNumber)}
                      >
                        {pageNumber}
                      </button>
                    ),
                  )}

                  <button
                    type="button"
                    className="terceros-pagination__nav"
                    onClick={() =>
                      setPage((current) => Math.min(pageCount, current + 1))
                    }
                    disabled={page >= pageCount}
                    aria-label="Página siguiente"
                  >
                    ›
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </section>

      <CreateJarvisTerceroModal
        isOpen={isModalOpen}
        onClose={closeModal}
        initialDocumentType={createDocumentType}
        initialDocumentNumber={createDocumentNumber}
        resumeDocumentId={resumeDocumentId}
        terceroToEdit={terceroToEdit}
        onCreated={handleSaved}
      />
    </main>
  )
}

export default TercerosPage
