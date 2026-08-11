import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
import { ChevronDownIcon, SearchIcon } from './icons/SidebarIcons'
import type { SupplierOption } from '../types/supplier'
import { formatSupplierOptionLabel } from '../types/supplier'

interface SupplierMultiSelectProps {
  id?: string
  options: SupplierOption[]
  selectedNits: string[]
  onChange: (selectedNits: string[]) => void
  disabled?: boolean
  placeholder?: string
  embedded?: boolean
}

function SupplierMultiSelect({
  id,
  options,
  selectedNits,
  onChange,
  disabled = false,
  placeholder = 'Buscar proveedor...',
  embedded = false,
}: SupplierMultiSelectProps) {
  const listboxId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const [inputValue, setInputValue] = useState('')
  const [isOpen, setIsOpen] = useState(false)

  const selectedSet = useMemo(() => new Set(selectedNits), [selectedNits])
  const isAllSelected = selectedNits.length === 0

  const filteredOptions = useMemo(() => {
    const query = inputValue.trim().toLowerCase()

    if (!query) {
      return options
    }

    return options.filter((supplier) => {
      const label = formatSupplierOptionLabel(supplier).toLowerCase()
      return (
        label.includes(query) ||
        supplier.nit.includes(query) ||
        supplier.name.toLowerCase().includes(query)
      )
    })
  }, [inputValue, options])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
        setInputValue('')
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const toggleSupplier = useCallback(
    (nit: string) => {
      if (selectedSet.has(nit)) {
        onChange(selectedNits.filter((value) => value !== nit))
        return
      }

      onChange([...selectedNits, nit])
    },
    [onChange, selectedNits, selectedSet],
  )

  const selectAll = useCallback(() => {
    onChange([])
    setInputValue('')
  }, [onChange])

  const displayValue = useMemo(() => {
    if (isAllSelected) {
      return 'Todos'
    }

    if (selectedNits.length === 1) {
      const supplier = options.find((option) => option.nit === selectedNits[0])
      return supplier ? formatSupplierOptionLabel(supplier) : '1 proveedor'
    }

    return `${selectedNits.length} proveedores seleccionados`
  }, [isAllSelected, options, selectedNits])

  const panel = (
    <div
      id={listboxId}
      className={[
        'supplier-multi-select__panel',
        embedded ? 'supplier-multi-select__panel--embedded' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      role="listbox"
    >
      <div className="supplier-multi-select__search-wrap">
        <span className="supplier-multi-select__search-icon" aria-hidden="true">
          <SearchIcon />
        </span>
        <input
          type="search"
          className="supplier-multi-select__search"
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          placeholder={placeholder}
          autoComplete="off"
        />
      </div>

      <label className="supplier-multi-select__option supplier-multi-select__option--all">
        <input
          type="checkbox"
          checked={isAllSelected}
          onChange={selectAll}
        />
        <span>Todos</span>
      </label>

      <div className="supplier-multi-select__options">
        {filteredOptions.length === 0 ? (
          <p className="supplier-multi-select__empty">No se encontraron proveedores</p>
        ) : (
          filteredOptions.map((supplier) => (
            <label
              key={supplier.nit}
              className="supplier-multi-select__option"
            >
              <input
                type="checkbox"
                checked={selectedSet.has(supplier.nit)}
                onChange={() => toggleSupplier(supplier.nit)}
              />
              <span>{formatSupplierOptionLabel(supplier)}</span>
            </label>
          ))
        )}
      </div>
    </div>
  )

  if (embedded) {
    return (
      <div className="supplier-multi-select supplier-multi-select--embedded" ref={containerRef}>
        {panel}
      </div>
    )
  }

  return (
    <div className="supplier-multi-select" ref={containerRef}>
      <button
        id={id}
        type="button"
        className="supplier-multi-select__trigger"
        onClick={() => !disabled && setIsOpen((current) => !current)}
        disabled={disabled}
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-haspopup="listbox"
      >
        <span className="supplier-multi-select__value">{displayValue}</span>
        <span className="supplier-multi-select__chevron" aria-hidden="true">
          <ChevronDownIcon />
        </span>
      </button>

      {isOpen && !disabled && panel}
    </div>
  )
}

export default SupplierMultiSelect
