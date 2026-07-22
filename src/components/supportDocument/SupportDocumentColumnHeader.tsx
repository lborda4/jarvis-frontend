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

function ColumnSortIcon({
  isActive,
  sortDirection,
}: {
  isActive: boolean
  sortDirection: 'asc' | 'desc'
}) {
  return (
    <span
      className={[
        'support-table__column-sort',
        isActive ? 'support-table__column-sort--active' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-hidden="true"
    >
      <span
        className={[
          'support-table__column-sort-arrow',
          isActive && sortDirection === 'asc'
            ? 'support-table__column-sort-arrow--active'
            : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        ▲
      </span>
      <span
        className={[
          'support-table__column-sort-arrow',
          isActive && sortDirection === 'desc'
            ? 'support-table__column-sort-arrow--active'
            : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        ▼
      </span>
    </span>
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
            {!children && (
              <ColumnSortIcon
                isActive={isSortActive}
                sortDirection={sortDirection}
              />
            )}
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
            <ColumnSortIcon
              isActive={isFilterActive || isSortActive}
              sortDirection={sortDirection}
            />
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
