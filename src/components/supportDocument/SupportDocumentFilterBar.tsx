import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ChevronDownIcon } from '../icons/SidebarIcons'
import SupplierMultiSelect from '../SupplierMultiSelect'
import ColumnCheckboxFilter, {
  buildSupportDocumentFilterOptions,
} from './SupportDocumentTableFilters'
import type { ElectronicDocumentFilterOptions } from '../../types/electronicDocument'
import type { ImportRowStatus } from '../../types/import'
import type { SupplierOption } from '../../types/supplier'
import type { SupportDocumentColumnFilters } from '../../types/supportDocumentTableFilters'
import { EMPTY_SUPPORT_DOCUMENT_COLUMN_FILTERS } from '../../types/supportDocumentTableFilters'

interface SupportDocumentFilterBarProps {
  filterOptions: ElectronicDocumentFilterOptions | null
  columnFilters: SupportDocumentColumnFilters
  selectedSupplierNits: string[]
  disabled?: boolean
  onSupplierNitsChange: (nits: string[]) => void
  onColumnFiltersChange: (
    updater: (current: SupportDocumentColumnFilters) => SupportDocumentColumnFilters,
  ) => void
}

type OpenFilterKey = 'date' | 'status' | null

function FilterDropdown({
  label,
  summary,
  isActive,
  isOpen,
  disabled,
  onToggle,
  onClose,
  children,
}: {
  label: string
  summary: string
  isActive: boolean
  isOpen: boolean
  disabled?: boolean
  onToggle: () => void
  onClose: () => void
  children: React.ReactNode
}) {
  const popoverId = useId()
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        onClose()
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  return (
    <div
      ref={containerRef}
      className={[
        'support-filter-bar__field',
        isActive ? 'support-filter-bar__field--active' : '',
        isOpen ? 'support-filter-bar__field--open' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span className="support-filter-bar__label">{label}</span>
      <button
        type="button"
        className="support-filter-bar__trigger"
        onClick={onToggle}
        disabled={disabled}
        aria-expanded={isOpen}
        aria-controls={popoverId}
      >
        <span className="support-filter-bar__trigger-text">{summary}</span>
        <span className="support-filter-bar__chevron" aria-hidden="true">
          <ChevronDownIcon />
        </span>
      </button>
      {isOpen && (
        <div
          id={popoverId}
          className="support-filter-bar__popover"
          role="dialog"
          aria-label={`Filtro de ${label}`}
        >
          {children}
        </div>
      )}
    </div>
  )
}

function buildSupplierFilterOptions(
  filterOptions: ElectronicDocumentFilterOptions | null,
): SupplierOption[] {
  if (!filterOptions) {
    return []
  }

  return filterOptions.suppliers.map((supplier) => ({
    nit: supplier.nit,
    name: supplier.name,
  }))
}

function SupportDocumentFilterBar({
  filterOptions,
  columnFilters,
  selectedSupplierNits,
  disabled = false,
  onSupplierNitsChange,
  onColumnFiltersChange,
}: SupportDocumentFilterBarProps) {
  const [openFilter, setOpenFilter] = useState<OpenFilterKey>(null)

  const columnFilterOptions = useMemo(
    () => buildSupportDocumentFilterOptions(filterOptions),
    [filterOptions],
  )
  const supplierOptions = useMemo(
    () => buildSupplierFilterOptions(filterOptions),
    [filterOptions],
  )

  const hasActiveFilters =
    columnFilters.dates.length > 0 ||
    columnFilters.statuses.length > 0 ||
    selectedSupplierNits.length > 0

  const dateSummary =
    columnFilters.dates.length === 0
      ? 'Todas'
      : columnFilters.dates.length === 1
        ? columnFilterOptions.dates.find(
            (option) => option.value === columnFilters.dates[0],
          )?.label ?? '1 seleccionada'
        : `${columnFilters.dates.length} seleccionadas`

  const statusSummary =
    columnFilters.statuses.length === 0
      ? 'Todos'
      : columnFilters.statuses.length === 1
        ? columnFilters.statuses[0]
        : `${columnFilters.statuses.length} seleccionados`

  const toggleDate = (date: string) => {
    onColumnFiltersChange((current) => {
      const nextDates = current.dates.includes(date)
        ? current.dates.filter((value) => value !== date)
        : [...current.dates, date]

      return {
        ...current,
        dates: nextDates,
      }
    })
  }

  const toggleStatus = (status: ImportRowStatus) => {
    onColumnFiltersChange((current) => {
      const nextStatuses = current.statuses.includes(status)
        ? current.statuses.filter((value) => value !== status)
        : [...current.statuses, status]

      return {
        ...current,
        statuses: nextStatuses,
      }
    })
  }

  const clearFilters = () => {
    onColumnFiltersChange(() => EMPTY_SUPPORT_DOCUMENT_COLUMN_FILTERS)
    onSupplierNitsChange([])
    setOpenFilter(null)
  }

  return (
    <section className="support-filter-bar" aria-label="Filtros de documentos">
      <div className="support-filter-bar__fields">
        <FilterDropdown
          label="Fecha"
          summary={dateSummary}
          isActive={columnFilters.dates.length > 0}
          isOpen={openFilter === 'date'}
          disabled={disabled}
          onToggle={() =>
            setOpenFilter((current) => (current === 'date' ? null : 'date'))
          }
          onClose={() => setOpenFilter(null)}
        >
          <ColumnCheckboxFilter
            options={columnFilterOptions.dates}
            selectedValues={columnFilters.dates}
            disabled={disabled}
            onToggle={toggleDate}
          />
        </FilterDropdown>

        <div
          className={[
            'support-filter-bar__field',
            selectedSupplierNits.length > 0
              ? 'support-filter-bar__field--active'
              : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <span className="support-filter-bar__label">Proveedor</span>
          <SupplierMultiSelect
            options={supplierOptions}
            selectedNits={selectedSupplierNits}
            onChange={onSupplierNitsChange}
            disabled={disabled}
            placeholder="Todos los proveedores"
          />
        </div>

        <FilterDropdown
          label="Estado"
          summary={statusSummary}
          isActive={columnFilters.statuses.length > 0}
          isOpen={openFilter === 'status'}
          disabled={disabled}
          onToggle={() =>
            setOpenFilter((current) => (current === 'status' ? null : 'status'))
          }
          onClose={() => setOpenFilter(null)}
        >
          <ColumnCheckboxFilter
            options={columnFilterOptions.statuses}
            selectedValues={columnFilters.statuses}
            disabled={disabled}
            onToggle={toggleStatus}
          />
        </FilterDropdown>
      </div>

      {hasActiveFilters && (
        <button
          type="button"
          className="support-filter-bar__clear"
          onClick={clearFilters}
          disabled={disabled}
        >
          Limpiar filtros
        </button>
      )}
    </section>
  )
}

export default SupportDocumentFilterBar
