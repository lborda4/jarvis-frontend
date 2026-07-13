import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import type { SupplierOption } from '../types/supplier'
import { formatSupplierOptionLabel } from '../types/supplier'

interface SupplierAutocompleteProps {
  id?: string
  options: SupplierOption[]
  value: SupplierOption | null
  onChange: (supplier: SupplierOption | null) => void
  disabled?: boolean
  placeholder?: string
}

function SupplierAutocomplete({
  id,
  options,
  value,
  onChange,
  disabled = false,
  placeholder = 'Buscar proveedor por nombre o NIT',
}: SupplierAutocompleteProps) {
  const listboxId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const [inputValue, setInputValue] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)

  useEffect(() => {
    setInputValue(value ? formatSupplierOptionLabel(value) : '')
  }, [value])

  const filteredOptions = useMemo(() => {
    const query = inputValue.trim().toLowerCase()

    if (
      !query ||
      (value && formatSupplierOptionLabel(value).toLowerCase() === query)
    ) {
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
  }, [inputValue, options, value])

  useEffect(() => {
    setHighlightedIndex(0)
  }, [filteredOptions])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
        setInputValue(value ? formatSupplierOptionLabel(value) : '')
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [value])

  const selectOption = useCallback(
    (supplier: SupplierOption) => {
      onChange(supplier)
      setInputValue(formatSupplierOptionLabel(supplier))
      setIsOpen(false)
    },
    [onChange],
  )

  const handleInputChange = (nextValue: string) => {
    setInputValue(nextValue)
    setIsOpen(true)

    if (!nextValue.trim()) {
      onChange(null)
    }
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setIsOpen(true)
      setHighlightedIndex((current) =>
        Math.min(current + 1, Math.max(filteredOptions.length - 1, 0)),
      )
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setIsOpen(true)
      setHighlightedIndex((current) => Math.max(current - 1, 0))
      return
    }

    if (event.key === 'Enter' && isOpen && filteredOptions[highlightedIndex]) {
      event.preventDefault()
      selectOption(filteredOptions[highlightedIndex])
      return
    }

    if (event.key === 'Escape') {
      setIsOpen(false)
      setInputValue(value ? formatSupplierOptionLabel(value) : '')
    }
  }

  return (
    <div className="account-autocomplete" ref={containerRef}>
      <input
        id={id}
        type="text"
        className="account-autocomplete__input"
        value={inputValue}
        onChange={(event) => handleInputChange(event.target.value)}
        onFocus={() => !disabled && setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-autocomplete="list"
        autoComplete="off"
      />

      {isOpen && !disabled && (
        <ul
          id={listboxId}
          className="account-autocomplete__list"
          role="listbox"
        >
          {filteredOptions.length === 0 ? (
            <li className="account-autocomplete__empty">
              No se encontraron proveedores
            </li>
          ) : (
            filteredOptions.map((supplier, index) => (
              <li
                key={supplier.nit}
                role="option"
                aria-selected={value?.nit === supplier.nit}
                className={`account-autocomplete__option${
                  index === highlightedIndex
                    ? ' account-autocomplete__option--highlighted'
                    : ''
                }`}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setHighlightedIndex(index)}
                onClick={() => selectOption(supplier)}
              >
                {formatSupplierOptionLabel(supplier)}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}

export default SupplierAutocomplete
