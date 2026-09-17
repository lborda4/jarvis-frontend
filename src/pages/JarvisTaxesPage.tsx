import { type FormEvent, useEffect, useMemo, useState } from 'react'
import Button from '../components/Button'
import ConfirmDialog from '../components/ConfirmDialog'
import ErrorMessage from '../components/ErrorMessage'
import JarvisTaxModal from '../components/JarvisTaxModal'
import LoadingIndicator from '../components/LoadingIndicator'
import PageHeader from '../components/PageHeader'
import SuccessMessage from '../components/SuccessMessage'
import { getApiErrorMessage } from '../services/apiClient'
import { deleteJarvisTax, fetchJarvisTaxes } from '../services/jarvisService'
import {
  companyQueryKey,
  peekCachedQuery,
} from '../services/queryCache'
import {
  JARVIS_TAX_CATEGORY,
  type JarvisTax,
  type JarvisTaxesListResponse,
} from '../types/jarvis'
import './JarvisTaxesPage.css'

const PAGE_SIZE = 10

type StatusFilter = 'all' | 'active' | 'inactive'

function PencilIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 20h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4 12.5-12.5z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0-1 14a2 2 0 01-2 2H7a2 2 0 01-2-2L4 6h16z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function formatRate(tax: JarvisTax): string {
  return tax.rate === null ? '—' : `${tax.rate} %`
}

function JarvisTaxesPage() {
  const cached = peekCachedQuery<JarvisTaxesListResponse>(
    companyQueryKey(['jarvis', 'taxes']),
  )
  const [items, setItems] = useState<JarvisTax[]>(() => cached?.items ?? [])
  const [isLoading, setIsLoading] = useState(!cached)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [taxTypeFilter, setTaxTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [page, setPage] = useState(1)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingTax, setEditingTax] = useState<JarvisTax | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const loadTaxes = async () => {
    setErrorMessage(null)

    try {
      const response = await fetchJarvisTaxes()
      setItems(response.items)
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(error, 'No se pudieron cargar los impuestos.'),
      )
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadTaxes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Buscar o filtrar siempre vuelve a la página 1 — si no, se podía quedar
  // "atrapado" en una página que ya no existe para el nuevo filtro.
  useEffect(() => {
    setPage(1)
  }, [search, taxTypeFilter, statusFilter])

  const taxTypeOptions = useMemo(() => {
    const types = new Set<string>()
    for (const item of items) types.add(item.tax_type)
    return [...types].sort((a, b) => a.localeCompare(b))
  }, [items])

  const filteredItems = useMemo(() => {
    const trimmedSearch = search.trim().toLowerCase()

    return items.filter((item) => {
      if (taxTypeFilter !== 'all' && item.tax_type !== taxTypeFilter) {
        return false
      }

      if (statusFilter === 'active' && !item.is_active) return false
      if (statusFilter === 'inactive' && item.is_active) return false

      if (
        trimmedSearch &&
        !item.code.toLowerCase().includes(trimmedSearch) &&
        !item.name.toLowerCase().includes(trimmedSearch)
      ) {
        return false
      }

      return true
    })
  }, [items, taxTypeFilter, statusFilter, search])

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageItems = filteredItems.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  )

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPage(1)
  }

  const openCreate = () => {
    setSuccessMessage(null)
    setErrorMessage(null)
    setEditingTax(null)
    setIsModalOpen(true)
  }

  const openEdit = (tax: JarvisTax) => {
    setSuccessMessage(null)
    setErrorMessage(null)
    setEditingTax(tax)
    setIsModalOpen(true)
  }

  const handleSaved = (tax: JarvisTax) => {
    setItems((current) => {
      const exists = current.some((item) => item.id === tax.id)
      return exists
        ? current.map((item) => (item.id === tax.id ? tax : item))
        : [...current, tax]
    })
    setSuccessMessage(
      editingTax
        ? `"${tax.name}" se actualizó correctamente.`
        : `"${tax.name}" se creó correctamente.`,
    )
  }

  const requestDelete = (id: string) => {
    setSuccessMessage(null)
    setErrorMessage(null)
    setPendingDeleteId(id)
  }

  const confirmDelete = async () => {
    if (!pendingDeleteId) return

    setIsDeleting(true)
    try {
      await deleteJarvisTax(pendingDeleteId)
      setItems((current) => current.filter((item) => item.id !== pendingDeleteId))
      setSuccessMessage('Impuesto eliminado correctamente.')
      setPendingDeleteId(null)
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'No se pudo eliminar el impuesto.'))
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <main className="jarvis-taxes-page">
      <PageHeader
        title="Impuestos y retenciones"
        description="Gestiona los impuestos y retenciones que podrás usar al emitir tus facturas electrónicas. Estos valores se mostrarán en los formularios de facturación para que puedas seleccionarlos rápidamente."
        actions={
          <Button variant="primary" onClick={openCreate}>
            Agregar impuesto
          </Button>
        }
      />

      {errorMessage && <ErrorMessage message={errorMessage} />}
      {successMessage && <SuccessMessage message={successMessage} />}

      <form className="jarvis-taxes-page__filters" onSubmit={handleSearchSubmit}>
        <div className="jarvis-taxes-page__field jarvis-taxes-page__field--grow">
          <label htmlFor="jarvis-taxes-search">Buscar</label>
          <input
            id="jarvis-taxes-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por código o nombre..."
          />
        </div>

        <div className="jarvis-taxes-page__field">
          <label htmlFor="jarvis-taxes-type-filter">Tipo de impuesto</label>
          <select
            id="jarvis-taxes-type-filter"
            value={taxTypeFilter}
            onChange={(event) => setTaxTypeFilter(event.target.value)}
          >
            <option value="all">Todos</option>
            {taxTypeOptions.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        <div className="jarvis-taxes-page__field">
          <label htmlFor="jarvis-taxes-status-filter">Estado</label>
          <select
            id="jarvis-taxes-status-filter"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as StatusFilter)
            }
          >
            <option value="all">Todos</option>
            <option value="active">Activo</option>
            <option value="inactive">Inactivo</option>
          </select>
        </div>
      </form>

      <section className="jarvis-taxes-page__list" aria-live="polite">
        {isLoading ? (
          <LoadingIndicator message="Cargando impuestos..." />
        ) : filteredItems.length === 0 ? (
          <div className="jarvis-taxes-page__empty">
            <p>
              {items.length === 0
                ? 'Aún no hay impuestos ni retenciones creados.'
                : 'Ningún registro coincide con los filtros.'}
            </p>
            <Button variant="primary" onClick={openCreate}>
              Agregar impuesto
            </Button>
          </div>
        ) : (
          <>
            <div className="jarvis-taxes-page__table-wrap">
              <table className="jarvis-taxes-page__table">
                <thead>
                  <tr>
                    <th>En uso</th>
                    <th>Código</th>
                    <th>Nombre</th>
                    <th>Tipo de impuesto</th>
                    <th>Tarifa</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={item.is_in_use}
                          disabled
                          aria-label={
                            item.is_in_use ? 'En uso' : 'No está en uso'
                          }
                        />
                      </td>
                      <td>{item.code}</td>
                      <td>{item.name}</td>
                      <td>{item.tax_type}</td>
                      <td>{formatRate(item)}</td>
                      <td>
                        <span
                          className={`jarvis-taxes-page__status jarvis-taxes-page__status--${
                            item.is_active ? 'active' : 'inactive'
                          }`}
                        >
                          {item.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td>
                        <div className="jarvis-taxes-page__actions">
                          <button
                            type="button"
                            className="jarvis-taxes-page__icon-btn"
                            onClick={() => openEdit(item)}
                            aria-label={`Editar ${item.name}`}
                          >
                            <PencilIcon />
                          </button>
                          <button
                            type="button"
                            className="jarvis-taxes-page__icon-btn jarvis-taxes-page__icon-btn--danger"
                            onClick={() => requestDelete(item.id)}
                            aria-label={`Eliminar ${item.name}`}
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="jarvis-taxes-page__pagination">
              <span>
                Mostrando {pageItems.length} de {filteredItems.length}{' '}
                {filteredItems.length === 1 ? 'registro' : 'registros'}
              </span>
              <div className="jarvis-taxes-page__pagination-controls">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setPage(currentPage - 1)}
                  aria-label="Página anterior"
                >
                  ‹
                </button>
                <span className="jarvis-taxes-page__pagination-current">
                  {currentPage}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage(currentPage + 1)}
                  aria-label="Página siguiente"
                >
                  ›
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      <JarvisTaxModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        defaultCategory={JARVIS_TAX_CATEGORY.IMPUESTO}
        editingTax={editingTax}
        onSaved={handleSaved}
      />

      <ConfirmDialog
        isOpen={pendingDeleteId !== null}
        title="Eliminar impuesto"
        message="¿Seguro que quieres eliminar este impuesto? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        variant="danger"
        isBusy={isDeleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDeleteId(null)}
      />
    </main>
  )
}

export default JarvisTaxesPage
