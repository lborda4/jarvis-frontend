import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Button from '../components/Button'
import CatalogRowActions from '../components/CatalogRowActions'
import ConfirmDialog from '../components/ConfirmDialog'
import CreateJarvisTerceroModal from '../components/CreateJarvisTerceroModal'
import ErrorMessage from '../components/ErrorMessage'
import LoadingIndicator from '../components/LoadingIndicator'
import PageHeader from '../components/PageHeader'
import SuccessMessage from '../components/SuccessMessage'
import { getApiErrorMessage } from '../services/apiClient'
import { deleteJarvisTercero, fetchJarvisTerceros } from '../services/jarvisService'
import {
  companyQueryKey,
  peekCachedQuery,
} from '../services/queryCache'
import {
  JARVIS_DOCUMENT_TYPE,
  JARVIS_DOCUMENT_TYPE_OPTIONS,
  JARVIS_ENTITY_TYPE_OPTIONS,
  JARVIS_TAX_REGIME_OPTIONS,
  type JarvisDocumentType,
  type JarvisEntityType,
  type JarvisTercero,
  type JarvisTercerosListResponse,
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

function formatTaxRegime(item: JarvisTercero): string {
  if (item.type_regime_name?.trim()) {
    return item.type_regime_name
  }

  if (item.type_regime_id === 2) {
    return 'No Responsable de IVA'
  }

  if (!item.tax_regime) return '—'
  return (
    JARVIS_TAX_REGIME_OPTIONS.find((option) => option.value === item.tax_regime)
      ?.label ?? item.tax_regime
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
  const [editingTercero, setEditingTercero] = useState<JarvisTercero | null>(null)
  const [pendingDelete, setPendingDelete] = useState<JarvisTercero | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [createDocumentType, setCreateDocumentType] = useState<string>(
    JARVIS_DOCUMENT_TYPE.NIT,
  )
  const [createDocumentNumber, setCreateDocumentNumber] = useState('')
  const [resumeDocumentId, setResumeDocumentId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const confirmDelete = async () => {
    if (!pendingDelete || isDeleting) return
    setIsDeleting(true)
    setErrorMessage(null)
    setSuccessMessage(null)
    try {
      await deleteJarvisTercero(pendingDelete.id)
      setItems((current) => current.filter((item) => item.id !== pendingDelete.id))
      setTotal((current) => Math.max(0, current - 1))
      setSuccessMessage(`Tercero "${pendingDelete.name}" eliminado correctamente.`)
      setPendingDelete(null)
    } catch (error) {
      setPendingDelete(null)
      setErrorMessage(getApiErrorMessage(error, 'No se pudo eliminar el tercero.'))
    } finally { setIsDeleting(false) }
  }

  const loadTerceros = useCallback(async (query?: string) => {
    const trimmed = query?.trim()
    setErrorMessage(null)

    if (!trimmed) {
      const cached = peekCachedQuery<JarvisTercerosListResponse>(
        companyQueryKey(['jarvis', 'terceros']),
      )
      if (cached) {
        setItems(cached.items)
        setTotal(cached.total)
        setIsLoading(false)
      } else {
        setIsLoading(true)
      }
    } else {
      setIsLoading(true)
    }

    try {
      const response = await fetchJarvisTerceros(trimmed)
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
    // La carga inicial muestra la caché y luego consulta el catálogo.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
    <main className="terceros-page integration-page">
      <PageHeader
        title="Terceros"
        description="Consulta y crea los terceros de tu empresa Jarvis."
        actions={
          <Button variant="primary" onClick={openCreate}>
            Crear
          </Button>
        }
      />

      {errorMessage && <ErrorMessage message={errorMessage} />}
      {successMessage && <SuccessMessage message={successMessage} />}

      <form className="terceros-page__search integration-filters" onSubmit={handleSearch}>
        <label htmlFor="terceros-search">Buscar</label>
        <div className="terceros-page__search-row">
          <input
            id="terceros-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nombre o documento"
          />
          <Button type="submit" variant="primary" disabled={isLoading}>
            Buscar
          </Button>
        </div>
      </form>

      <section className="terceros-page__list integration-card" aria-live="polite">
        <div className="terceros-page__list-header integration-card-header">
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
            <Button variant="primary" onClick={openCreate}>
              Crear el primero
            </Button>
          </div>
        ) : (
          <div className="terceros-page__table-wrap">
            <table className="terceros-page__table integration-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Documento</th>
                  <th>Tipo</th>
                  <th>Régimen</th>
                  <th>Contacto</th>
                  <th>Acciones</th>
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
                    <td>{formatTaxRegime(item)}</td>
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
                    <td><CatalogRowActions name={item.name} onEdit={() => setEditingTercero(item)} onDelete={() => setPendingDelete(item)} disabled={isDeleting} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ConfirmDialog isOpen={pendingDelete !== null} title="Eliminar tercero"
        message={`¿Seguro que quieres eliminar "${pendingDelete?.name ?? ''}"? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar" variant="danger" isBusy={isDeleting}
        onConfirm={() => void confirmDelete()} onCancel={() => { if (!isDeleting) setPendingDelete(null) }} />
      {editingTercero && <CreateJarvisTerceroModal
        key={editingTercero.id} isOpen editingTercero={editingTercero}
        onClose={() => setEditingTercero(null)}
        onCreated={(tercero) => {
          setSuccessMessage(`Tercero "${tercero.name}" actualizado correctamente.`)
          setItems((current) => current.map((item) => item.id === tercero.id ? tercero : item))
          void loadTerceros(search)
        }}
      />}
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
