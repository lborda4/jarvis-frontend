import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react'
import type { ProductResponse } from '../services/productService'
import { findProductIvaTax } from '../utils/productTaxes'

export interface JarvisProductSearchProps {
  id?: string
  value: string
  onChange: (value: string) => void
  onSelectProduct: (product: ProductResponse) => void
  products: ProductResponse[]
  isLoading?: boolean
  disabled?: boolean
  placeholder?: string
  className?: string
}

function resolveProductMainPrice(product: ProductResponse): number | null {
  const lists = [...(product.priceLists ?? [])].sort((a, b) => a.position - b.position)
  if (lists.length === 0) return null
  const firstEnabled = lists.find((list) => list.enabled)
  return (firstEnabled ?? lists[0]).price
}

export default function JarvisProductSearch({
  id,
  value,
  onChange,
  onSelectProduct,
  products,
  isLoading = false,
  disabled = false,
  placeholder = 'Buscar...',
  className = '',
}: JarvisProductSearchProps) {
  const listboxId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const blurTimeoutRef = useRef<number | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const [floatingStyle, setFloatingStyle] = useState<CSSProperties>({})

  const updatePosition = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    const rect = container.getBoundingClientRect()
    const LIST_GAP = 6
    const LIST_MAX_HEIGHT = 250
    const spaceBelow = window.innerHeight - rect.bottom - LIST_GAP
    const spaceAbove = rect.top - LIST_GAP
    const openAbove = spaceBelow < 180 && spaceAbove > spaceBelow

    const width = Math.max(rect.width, 320)
    let left = rect.left
    if (left + width > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - width - 12)
    }

    if (openAbove) {
      setFloatingStyle({
        position: 'fixed',
        left,
        width,
        bottom: window.innerHeight - rect.top + LIST_GAP,
        maxHeight: Math.min(LIST_MAX_HEIGHT, Math.max(spaceAbove, 120)),
        zIndex: 1000,
      })
      return
    }

    setFloatingStyle({
      position: 'fixed',
      left,
      width,
      top: rect.bottom + LIST_GAP,
      maxHeight: Math.min(LIST_MAX_HEIGHT, Math.max(spaceBelow, 120)),
      zIndex: 1000,
    })
  }, [])

  useLayoutEffect_safe(() => {
    if (!isOpen) return
    updatePosition()

    const handleReposition = () => updatePosition()
    window.addEventListener('resize', handleReposition)
    window.addEventListener('scroll', handleReposition, true)

    return () => {
      window.removeEventListener('resize', handleReposition)
      window.removeEventListener('scroll', handleReposition, true)
    }
  }, [isOpen, updatePosition])

  const filteredProducts = useMemo(() => {
    const query = value.trim().toLowerCase()
    if (!query) return products

    return products.filter((item) => {
      const name = item.name.toLowerCase()
      const sku = item.sku.toLowerCase()
      const desc = item.description ? item.description.toLowerCase() : ''
      return name.includes(query) || sku.includes(query) || desc.includes(query)
    })
  }, [products, value])

  useEffect(() => {
    setHighlightedIndex(0)
  }, [filteredProducts])

  const handleSelect = useCallback(
    (product: ProductResponse) => {
      onSelectProduct(product)
      setIsOpen(false)
    },
    [onSelectProduct],
  )

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (!isOpen) {
        setIsOpen(true)
        return
      }
      setHighlightedIndex((current) =>
        Math.min(current + 1, Math.max(filteredProducts.length - 1, 0)),
      )
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (!isOpen) {
        setIsOpen(true)
        return
      }
      setHighlightedIndex((current) => Math.max(current - 1, 0))
      return
    }

    if (event.key === 'Enter' && isOpen && filteredProducts[highlightedIndex]) {
      event.preventDefault()
      handleSelect(filteredProducts[highlightedIndex])
      return
    }

    if (event.key === 'Escape') {
      setIsOpen(false)
    }
  }

  const handleFocus = () => {
    if (disabled) return
    if (blurTimeoutRef.current) {
      window.clearTimeout(blurTimeoutRef.current)
    }
    setIsOpen(true)
    updatePosition()
  }

  const handleBlur = () => {
    if (blurTimeoutRef.current) {
      window.clearTimeout(blurTimeoutRef.current)
    }
    blurTimeoutRef.current = window.setTimeout(() => {
      setIsOpen(false)
    }, 180)
  }

  return (
    <div
      ref={containerRef}
      className={`ds-individual__search ds-individual__product-search ${className}`.trim()}
    >
      <input
        id={id}
        type="search"
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        autoComplete="off"
        onFocus={handleFocus}
        onBlur={handleBlur}
        onChange={(e) => {
          onChange(e.target.value)
          if (!isOpen) {
            setIsOpen(true)
          }
          updatePosition()
        }}
        onKeyDown={handleKeyDown}
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-autocomplete="list"
      />
      <span className="ds-individual__search-icon" aria-hidden="true">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      </span>

      {isOpen && !disabled && (
        <ul
          id={listboxId}
          className="ds-individual__supplier-list ds-individual__product-list"
          style={floatingStyle}
          role="listbox"
        >
          {isLoading ? (
            <li className="ds-individual__supplier-empty">Cargando productos y servicios...</li>
          ) : filteredProducts.length === 0 ? (
            <li className="ds-individual__supplier-empty">
              {products.length === 0
                ? 'No hay productos o servicios creados aún.'
                : 'No hay coincidencias con esa búsqueda.'}
            </li>
          ) : (
            filteredProducts.slice(0, 50).map((product, idx) => {
              const mainPrice = resolveProductMainPrice(product)
              const ivaTax = findProductIvaTax(product)
              const isSelected = idx === highlightedIndex

              return (
                <li key={product.id}>
                  <button
                    type="button"
                    className={`ds-individual__supplier-option ds-individual__product-option${
                      isSelected ? ' is-selected' : ''
                    }`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelect(product)}
                  >
                    <div className="ds-individual__product-option-head">
                      <strong>{product.name}</strong>
                      <span
                        className={`ds-individual__product-badge ds-individual__product-badge--${product.kind}`}
                      >
                        {product.kind === 'service' ? 'Servicio' : 'Producto'}
                      </span>
                    </div>
                    <div className="ds-individual__product-option-meta">
                      {product.sku && (
                        <span className="ds-individual__product-sku">{product.sku}</span>
                      )}
                      {product.unit && <span>· {product.unit}</span>}
                      {mainPrice != null && (
                        <span className="ds-individual__product-price">
                          · ${mainPrice.toLocaleString('es-CO')}
                        </span>
                      )}
                      {ivaTax && (
                        <span className="ds-individual__product-tax">
                          · IVA {ivaTax.rate ?? 19}%
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              )
            })
          )}
        </ul>
      )}
    </div>
  )
}

function useLayoutEffect_safe(effect: () => void | (() => void), deps: unknown[]) {
  const isBrowser = typeof window !== 'undefined'
  useEffect(isBrowser ? effect : () => {}, deps)
}
