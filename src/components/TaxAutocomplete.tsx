import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react'
import {
  formatTaxOptionLabel,
  type SiigoTaxOption,
} from '../constants/siigoTaxCatalog'

interface TaxAutocompleteProps {
  id?: string
  value: SiigoTaxOption | null
  onChange: (tax: SiigoTaxOption | null) => void
  disabled?: boolean
  placeholder?: string
  options?: SiigoTaxOption[]
}

function TaxAutocomplete({
  id,
  value,
  onChange,
  disabled = false,
  placeholder = 'Buscar retención...',
  options = [],
}: TaxAutocompleteProps) {
  const listboxId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const [inputValue, setInputValue] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const [listStyle, setListStyle] = useState<CSSProperties>({})

  const LIST_MAX_HEIGHT = 220
  const LIST_GAP = 6

  const updateListPosition = useCallback(() => {
    const container = containerRef.current

    if (!container) {
      return
    }

    const rect = container.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom - LIST_GAP
    const spaceAbove = rect.top - LIST_GAP
    const openAbove = spaceBelow < 160 && spaceAbove > spaceBelow

    if (openAbove) {
      setListStyle({
        position: 'fixed',
        left: rect.left,
        width: rect.width,
        bottom: window.innerHeight - rect.top + LIST_GAP,
        maxHeight: Math.min(LIST_MAX_HEIGHT, Math.max(spaceAbove, 120)),
        zIndex: 1000,
      })
      return
    }

    setListStyle({
      position: 'fixed',
      left: rect.left,
      width: rect.width,
      top: rect.bottom + LIST_GAP,
      maxHeight: Math.min(LIST_MAX_HEIGHT, Math.max(spaceBelow, 120)),
      zIndex: 1000,
    })
  }, [])

  const formatDisplayLabel = useCallback((tax: SiigoTaxOption | null) => {
    if (!tax) return ''
    return formatTaxOptionLabel(tax)
  }, [])

  useEffect(() => {
    setInputValue(formatDisplayLabel(value))
  }, [formatDisplayLabel, value])

  const filteredOptions = useMemo(() => {
    const query = inputValue.trim().toLowerCase()

    if (!query || (value && formatTaxOptionLabel(value).toLowerCase() === query)) {
      return options
    }

    return options.filter((tax) => {
      const label = formatTaxOptionLabel(tax).toLowerCase()
      return (
        label.includes(query) ||
        String(tax.id).includes(query) ||
        tax.name.toLowerCase().includes(query)
      )
    })
  }, [inputValue, options, value])

  useEffect(() => {
    setHighlightedIndex(0)
  }, [filteredOptions])

  useLayoutEffect(() => {
    if (!isOpen) {
      return
    }

    updateListPosition()

    const handleReposition = () => updateListPosition()

    window.addEventListener('resize', handleReposition)
    window.addEventListener('scroll', handleReposition, true)

    return () => {
      window.removeEventListener('resize', handleReposition)
      window.removeEventListener('scroll', handleReposition, true)
    }
  }, [isOpen, filteredOptions.length, updateListPosition])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
        setInputValue(formatDisplayLabel(value))
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [formatDisplayLabel, value])

  const selectOption = useCallback(
    (tax: SiigoTaxOption) => {
      onChange(tax)
      setInputValue(formatDisplayLabel(tax))
      setIsOpen(false)
    },
    [formatDisplayLabel, onChange],
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
      setInputValue(formatDisplayLabel(value))
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
          className="account-autocomplete__list account-autocomplete__list--floating"
          style={listStyle}
          role="listbox"
        >
          {filteredOptions.length === 0 ? (
            <li className="account-autocomplete__empty">
              No se encontraron retenciones
            </li>
          ) : (
            filteredOptions.map((tax, index) => (
              <li
                key={tax.id}
                role="option"
                aria-selected={value?.id === tax.id}
                className={`account-autocomplete__option${
                  index === highlightedIndex
                    ? ' account-autocomplete__option--highlighted'
                    : ''
                }`}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setHighlightedIndex(index)}
                onClick={() => selectOption(tax)}
              >
                {formatTaxOptionLabel(tax)}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}

export default TaxAutocomplete
