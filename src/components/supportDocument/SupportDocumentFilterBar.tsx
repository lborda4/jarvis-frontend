import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { createPortal } from 'react-dom'
import DateRangePicker, { type DateRangePickerValue } from '../DateRangePicker'
import { ChevronDownIcon } from '../icons/SidebarIcons'
import SupplierMultiSelect from '../SupplierMultiSelect'
import ColumnCheckboxFilter, {
  buildSupportDocumentFilterOptions,
} from './SupportDocumentTableFilters'
import { formatSupportDocumentTableDate } from '../../utils/formatSupportDocumentTableDisplay'
import type { ElectronicDocumentFilterOptions } from '../../types/electronicDocument'
import type { ImportRowStatus } from '../../types/import'
import type { SupplierOption } from '../../types/supplier'
import type { SupportDocumentColumnFilters } from '../../types/supportDocumentTableFilters'
import { EMPTY_SUPPORT_DOCUMENT_COLUMN_FILTERS } from '../../types/supportDocumentTableFilters'

const PANEL_GAP = 6

interface SupportDocumentFilterBarProps {
  filterOptions: ElectronicDocumentFilterOptions | null
  columnFilters: SupportDocumentColumnFilters
  selectedSupplierNits: string[]
  disabled?: boolean
  /** Factura de compra: el filtro de Fecha se ve como un calendario
   * "desde"/"hasta" en vez de la lista de fechas exactas que usa Documento
   * Soporte — con Documento Soporte el volumen de fechas distintas suele ser
   * chico (varias facturas comparten fecha de cargue), pero en Factura de
   * compra cada factura trae su propia fecha de emisión, así que un rango es
   * mucho más usable que tildar fecha por fecha. */
  dateRangeFilter?: boolean
  /** Factura de compra SIIGO: agrega "Requiere revisión" y "Existente en
   * SIIGO" a las opciones del filtro de Estado — ver
   * buildSupportDocumentFilterOptions, son estados que solo existen en el
   * frontend, no vienen en filterOptions.importStatuses del backend. */
  showPurchaseInvoiceDerivedStatuses?: boolean
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
  /** Cuando es true, el contenido se porta a document.body y se posiciona
   * con position:fixed calculado desde el trigger, en vez de usar
   * position:absolute relativo al propio trigger. Necesario para no quedar
   * atrapado/tapado por cualquier ancestro con su propio stacking context
   * (bug real: al mover la barra de selección para que quedara justo debajo
   * de los filtros, ese contenedor sticky con z-index propio terminó
   * tapando el popover de "Estado" al abrirlo). */
  portal = false,
  /** Cuando es true, el popover no trae su propia tarjeta blanca (fondo/
   * borde/relleno) — para contenido que ya se estiliza completo a sí mismo,
   * como el calendario de rango de Factura de compra (fondo oscuro propio).
   * El resto de los filtros (listas de checkboxes) sí necesitan la tarjeta
   * del popover, así que se dejan con el chrome por defecto. */
  bare = false,
  onToggle,
  onClose,
  children,
}: {
  label: string
  summary: string
  isActive: boolean
  isOpen: boolean
  disabled?: boolean
  portal?: boolean
  bare?: boolean
  onToggle: () => void
  onClose: () => void
  children: React.ReactNode
}) {
  const popoverId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({})

  const updatePanelPosition = useCallback(() => {
    const trigger = containerRef.current
    if (!trigger) return

    const rect = trigger.getBoundingClientRect()
    setPanelStyle({
      position: 'fixed',
      left: rect.left,
      top: rect.bottom + PANEL_GAP,
      zIndex: 1000,
    })
  }, [])

  useLayoutEffect(() => {
    if (!isOpen || !portal) {
      return
    }

    updatePanelPosition()
    const handle = () => updatePanelPosition()
    window.addEventListener('resize', handle)
    window.addEventListener('scroll', handle, true)

    return () => {
      window.removeEventListener('resize', handle)
      window.removeEventListener('scroll', handle, true)
    }
  }, [isOpen, portal, updatePanelPosition])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node

      if (containerRef.current?.contains(target)) {
        return
      }

      // En modo portal el panel deja de ser descendiente de containerRef en
      // el DOM (ver render más abajo) — sin este chequeo, cualquier clic
      // adentro (elegir un día, cambiar de mes) se veía como "afuera" y
      // cerraba el filtro antes de que el clic surtiera efecto.
      if (panelRef.current?.contains(target)) {
        return
      }

      onClose()
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

  const panel = isOpen && (
    <div
      ref={panelRef}
      id={popoverId}
      className={[
        'support-filter-bar__popover',
        bare ? 'support-filter-bar__popover--bare' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      role="dialog"
      aria-label={`Filtro de ${label}`}
      style={portal ? panelStyle : undefined}
    >
      {children}
    </div>
  )

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
      {panel && (portal ? createPortal(panel, document.body) : panel)}
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
  dateRangeFilter = false,
  showPurchaseInvoiceDerivedStatuses = false,
  onSupplierNitsChange,
  onColumnFiltersChange,
}: SupportDocumentFilterBarProps) {
  const [openFilter, setOpenFilter] = useState<OpenFilterKey>(null)

  const columnFilterOptions = useMemo(
    () =>
      buildSupportDocumentFilterOptions(
        filterOptions,
        showPurchaseInvoiceDerivedStatuses,
      ),
    [filterOptions, showPurchaseInvoiceDerivedStatuses],
  )
  const supplierOptions = useMemo(
    () => buildSupplierFilterOptions(filterOptions),
    [filterOptions],
  )

  const hasActiveFilters =
    columnFilters.dates.length > 0 ||
    Boolean(columnFilters.dateFrom) ||
    Boolean(columnFilters.dateTo) ||
    columnFilters.statuses.length > 0 ||
    selectedSupplierNits.length > 0

  const dateSummary = dateRangeFilter
    ? !columnFilters.dateFrom && !columnFilters.dateTo
      ? 'Todas'
      : columnFilters.dateFrom && columnFilters.dateTo
        ? `${formatSupportDocumentTableDate(columnFilters.dateFrom)} – ${formatSupportDocumentTableDate(columnFilters.dateTo)}`
        : columnFilters.dateFrom
          ? `Desde ${formatSupportDocumentTableDate(columnFilters.dateFrom)}`
          : `Hasta ${formatSupportDocumentTableDate(columnFilters.dateTo!)}`
    : columnFilters.dates.length === 0
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

  const handleDateRangeApply = (range: DateRangePickerValue) => {
    onColumnFiltersChange((current) => ({
      ...current,
      dateFrom: range.dateFrom,
      dateTo: range.dateTo,
    }))
    setOpenFilter(null)
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
          isActive={
            columnFilters.dates.length > 0 ||
            Boolean(columnFilters.dateFrom) ||
            Boolean(columnFilters.dateTo)
          }
          isOpen={openFilter === 'date'}
          disabled={disabled}
          portal
          bare={dateRangeFilter}
          onToggle={() =>
            setOpenFilter((current) => (current === 'date' ? null : 'date'))
          }
          onClose={() => setOpenFilter(null)}
        >
          {dateRangeFilter ? (
            <DateRangePicker
              dateFrom={columnFilters.dateFrom}
              dateTo={columnFilters.dateTo}
              onApply={handleDateRangeApply}
            />
          ) : (
            <ColumnCheckboxFilter
              options={columnFilterOptions.dates}
              selectedValues={columnFilters.dates}
              disabled={disabled}
              onToggle={toggleDate}
            />
          )}
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
          portal
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
