import { useEffect, useId, useRef } from 'react'
import type { SupportDocumentSortColumn } from '../../types/supportDocumentTableFilters'

interface SupportDocumentColumnHeaderProps {
  label: string
  stackLabel?: boolean
  sortColumn?: SupportDocumentSortColumn
  activeSortColumn: SupportDocumentSortColumn | null
  sortDirection: 'asc' | 'desc'
  isFilterActive?: boolean
  isFilterOpen?: boolean
  disabled?: boolean
  onSort?: (column: SupportDocumentSortColumn) => void
  onHeaderClick?: (column: SupportDocumentSortColumn) => void
  onToggleFilter?: () => void
  onCloseFilter?: () => void
  children?: React.ReactNode
}

function ColumnFilterIcon() {
  return (
    <svg
      className="support-table__column-filter-icon"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2.5 3.5h11l-4.25 5v4l-2.5 1.25V8.5L2.5 3.5Z" />
    </svg>
  )
}

function SupportDocumentColumnHeader({
  label,
  stackLabel = false,
  sortColumn,
  activeSortColumn,
  sortDirection,
  isFilterActive = false,
  isFilterOpen = false,
  disabled = false,
  onSort,
  onHeaderClick,
  onToggleFilter,
  onCloseFilter,
  children,
}: SupportDocumentColumnHeaderProps) {
  const popoverId = useId()
  const containerRef = useRef<HTMLTableCellElement>(null)
  const handleHeaderClick =
    sortColumn != null ? (onHeaderClick ?? onSort) : undefined
  const isSortable = Boolean(sortColumn && handleHeaderClick)
  const isSortActive = sortColumn != null && activeSortColumn === sortColumn
  const sortAriaLabel = isSortActive
    ? `${label}, ordenado ${sortDirection === 'asc' ? 'ascendente' : 'descendente'}`
    : `Ordenar por ${label}`

  useEffect(() => {
    if (!isFilterOpen) {
      return
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        onCloseFilter?.()
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseFilter?.()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isFilterOpen, onCloseFilter])

  return (
    <th
      ref={containerRef}
      className={[
        'support-table__column-header',
        isFilterActive ? 'support-table__column-header--filtered' : '',
        isFilterOpen ? 'support-table__column-header--open' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="support-table__column-header-inner">
        {isSortable ? (
          <button
            type="button"
            className="support-table__column-label"
            onClick={() => sortColumn && handleHeaderClick?.(sortColumn)}
            disabled={disabled}
            aria-label={sortAriaLabel}
          >
            <span
              className={[
                'support-table__column-label-text',
                stackLabel ? 'support-table__column-label-text--stacked' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {label}
            </span>
          </button>
        ) : (
          <span
            className={[
              'support-table__column-label-text',
              stackLabel ? 'support-table__column-label-text--stacked' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {label}
          </span>
        )}

        {children && onToggleFilter && (
          <button
            type="button"
            className={[
              'support-table__column-filter-btn',
              isFilterActive ? 'support-table__column-filter-btn--active' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={onToggleFilter}
            disabled={disabled}
            aria-expanded={isFilterOpen}
            aria-controls={popoverId}
            aria-label={`Filtrar ${label}`}
          >
            <ColumnFilterIcon />
          </button>
        )}
      </div>

      {children && isFilterOpen && (
        <div
          id={popoverId}
          className="support-table__column-popover"
          role="dialog"
          aria-label={`Filtro de ${label}`}
        >
          {children}
        </div>
      )}
    </th>
  )
}

export default SupportDocumentColumnHeader
