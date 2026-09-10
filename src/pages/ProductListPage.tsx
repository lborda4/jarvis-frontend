import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../components/Button'
import ErrorMessage from '../components/ErrorMessage'
import LoadingIndicator from '../components/LoadingIndicator'
import PageHeader from '../components/PageHeader'
import { PackageIcon } from '../components/icons/SidebarIcons'
import { getApiErrorMessage } from '../services/apiClient'
import { fetchProducts, type ProductResponse } from '../services/productService'
import {
  companyQueryKey,
  peekCachedQuery,
} from '../services/queryCache'
import type { ProductsListResponse } from '../services/productService'
import './CreateProductPage.css'
import './ProductListPage.css'

type KindFilter = 'all' | 'product' | 'service'

function formatKind(kind: string): string {
  if (kind === 'service') return 'Servicio'
  if (kind === 'product') return 'Producto'
  return kind
}

function formatMoney(amount: number): string {
  return `$${amount.toLocaleString('es-CO')}`
}

/** Precio de referencia: el de la lista activa de menor posición, o el de la
 * lista de menor posición si ninguna está activa. */
function resolveMainPrice(product: ProductResponse): number | null {
  const lists = [...product.priceLists].sort((a, b) => a.position - b.position)
  if (lists.length === 0) return null
  const firstEnabled = lists.find((list) => list.enabled)
  return (firstEnabled ?? lists[0]).price
}

function formatIva(product: ProductResponse): string {
  if (!product.applyIva) return 'Sin IVA'
  if (product.ivaRate === null) return 'IVA'
  return `IVA ${product.ivaRate}%`
}

function ProductListPage() {
  const navigate = useNavigate()
  // Semilla desde la caché de empresa (si existe) para mostrar algo al instante
  // sin parpadeo mientras el efecto revalida contra el backend.
  const cachedList = peekCachedQuery<ProductsListResponse>(
    companyQueryKey(['products', 'list']),
  )
  const [items, setItems] = useState<ProductResponse[]>(
    () => cachedList?.items ?? [],
  )
  const [total, setTotal] = useState(() => cachedList?.total ?? 0)
  const [search, setSearch] = useState('')
  const [kindFilter, setKindFilter] = useState<KindFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [isLoading, setIsLoading] = useState(!cachedList)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const loadProducts = useCallback(async (query?: string) => {
    const trimmed = query?.trim()

    try {
      const response = await fetchProducts(trimmed)
      setItems(response.items)
      setTotal(response.total)
      setErrorMessage(null)
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(error, 'No se pudieron cargar los productos.'),
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadProducts()
  }, [loadProducts])

  const runSearch = (query?: string) => {
    setIsLoading(true)
    void loadProducts(query)
  }

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    runSearch(search)
  }

  // Categorías presentes en el resultado actual, para el filtro por categoría.
  const categoryOptions = useMemo(() => {
    const names = new Set<string>()
    for (const item of items) {
      if (item.categoryName) names.add(item.categoryName)
    }
    return [...names].sort((a, b) => a.localeCompare(b))
  }, [items])

  // Los filtros de tipo y categoría se aplican del lado cliente sobre lo que
  // ya trajo el backend (el buscador de texto sí va al servidor).
  const visibleItems = useMemo(() => {
    return items.filter((item) => {
      if (kindFilter !== 'all' && item.kind !== kindFilter) return false
      if (categoryFilter !== 'all' && item.categoryName !== categoryFilter) {
        return false
      }
      return true
    })
  }, [items, kindFilter, categoryFilter])

  const hasActiveFilters =
    kindFilter !== 'all' || categoryFilter !== 'all' || search.trim() !== ''

  const clearFilters = () => {
    setSearch('')
    setKindFilter('all')
    setCategoryFilter('all')
    runSearch()
  }

  return (
    <main className="product-list-page">
      <PageHeader
        title="Listar productos"
        description="Consulta el catálogo de productos y servicios registrados en Jarvis."
        actions={
          <Button
            variant="primary"
            onClick={() => navigate('/productos/crear')}
          >
            Crear producto
          </Button>
        }
      />

      {errorMessage && <ErrorMessage message={errorMessage} />}

      <form className="product-filters" onSubmit={handleSearch}>
        <div className="product-filters__field product-filters__field--grow">
          <label htmlFor="product-search">Buscar</label>
          <div className="product-filters__search-row">
            <input
              id="product-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Código / SKU o nombre"
            />
            <Button type="submit" variant="primary" disabled={isLoading}>
              Buscar
            </Button>
          </div>
        </div>

        <div className="product-filters__field">
          <label htmlFor="product-kind">Tipo</label>
          <select
            id="product-kind"
            value={kindFilter}
            onChange={(event) => setKindFilter(event.target.value as KindFilter)}
          >
            <option value="all">Todos</option>
            <option value="product">Producto</option>
            <option value="service">Servicio</option>
          </select>
        </div>

        <div className="product-filters__field">
          <label htmlFor="product-category">Categoría</label>
          <select
            id="product-category"
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
          >
            <option value="all">Todas</option>
            {categoryOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>

        {hasActiveFilters && (
          <Button
            type="button"
            variant="ghost"
            onClick={clearFilters}
            disabled={isLoading}
          >
            Limpiar
          </Button>
        )}
      </form>

      <section className="product-list" aria-live="polite">
        <div className="product-list__header">
          <h2>Catálogo</h2>
          <p>
            {visibleItems.length}
            {visibleItems.length === total
              ? ''
              : ` de ${total}`}{' '}
            {total === 1 ? 'producto' : 'productos'}
          </p>
        </div>

        {isLoading ? (
          <LoadingIndicator message="Cargando productos..." />
        ) : total === 0 ? (
          <div className="product-list-empty">
            <PackageIcon className="product-list-empty__icon" />
            <strong>Aún no hay productos creados</strong>
            <p>Crea tu primer producto para verlo en este listado.</p>
            <Button
              variant="primary"
              onClick={() => navigate('/productos/crear')}
            >
              Crear producto
            </Button>
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="product-list-empty">
            <PackageIcon className="product-list-empty__icon" />
            <strong>Ningún producto coincide con los filtros</strong>
            <p>Ajusta la búsqueda o los filtros para ver resultados.</p>
            <Button variant="outline" onClick={clearFilters}>
              Limpiar filtros
            </Button>
          </div>
        ) : (
          <div className="product-list__table-wrap">
            <table className="product-list__table">
              <thead>
                <tr>
                  <th>Código / SKU</th>
                  <th>Nombre</th>
                  <th>Tipo</th>
                  <th>Categoría</th>
                  <th>IVA</th>
                  <th className="product-list__num">Precio</th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((item) => {
                  const price = resolveMainPrice(item)
                  return (
                    <tr key={item.id}>
                      <td>
                        <span className="product-list__sku">{item.sku}</span>
                      </td>
                      <td>
                        <strong>{item.name}</strong>
                        {item.description ? (
                          <span className="product-list__muted">
                            {item.description}
                          </span>
                        ) : null}
                      </td>
                      <td>{formatKind(item.kind)}</td>
                      <td>{item.categoryName ?? '—'}</td>
                      <td>{formatIva(item)}</td>
                      <td className="product-list__num">
                        {price === null ? '—' : formatMoney(price)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}

export default ProductListPage
