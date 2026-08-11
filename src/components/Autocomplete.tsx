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

const LIST_MAX_HEIGHT = 220
const LIST_GAP = 6

export interface AutocompleteProps<T> {
  id?: string
  value: T | null
  onChange: (value: T | null) => void
  options: T[]
  disabled?: boolean
  placeholder?: string
  emptyMessage: string
  getOptionKey: (option: T) => string | number
  getOptionLabel: (option: T) => string
  /** Texto mostrado en el input para el valor actual. Por defecto, getOptionLabel(value). */
  formatValueLabel?: (value: T | null) => string
  /** Predicado de búsqueda por opción. Por defecto, getOptionLabel(option) incluye el query. */
  isOptionMatch?: (option: T, query: string) => boolean
  className?: string
}

/**
 * Combobox de búsqueda genérico, con posicionamiento flotante (se voltea hacia
 * arriba si no cabe abajo del viewport). Compartido por los 5 autocompletes de
 * la app (cuenta, centro de costo, medio de pago, retención, proveedor) — antes
 * cada uno reimplementaba esta misma lógica por separado.
 */
function Autocomplete<T>({
  id,
  value,
  onChange,
  options,
  disabled = false,
  placeholder,
  emptyMessage,
  getOptionKey,
  getOptionLabel,
  formatValueLabel,
  isOptionMatch,
  className = 'account-autocomplete',
}: AutocompleteProps<T>) {
  const listboxId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const [inputValue, setInputValue] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const [listStyle, setListStyle] = useState<CSSProperties>({})

  const resolveValueLabel = useCallback(
    (current: T | null) => {
      if (formatValueLabel) {
        return formatValueLabel(current)
      }
      return current ? getOptionLabel(current) : ''
    },
    [formatValueLabel, getOptionLabel],
  )

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

  useEffect(() => {
    setInputValue(resolveValueLabel(value))
  }, [resolveValueLabel, value])

  const filteredOptions = useMemo(() => {
    const query = inputValue.replace(/^★\s*/, '').trim().toLowerCase()

    if (!query || (value && getOptionLabel(value).toLowerCase() === query)) {
      return options
    }

    const matches = isOptionMatch
      ? (option: T) => isOptionMatch(option, query)
      : (option: T) => getOptionLabel(option).toLowerCase().includes(query)

    return options.filter(matches)
  }, [inputValue, options, value, getOptionLabel, isOptionMatch])

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
        setInputValue(resolveValueLabel(value))
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [resolveValueLabel, value])

  const selectOption = useCallback(
    (option: T) => {
      onChange(option)
      setInputValue(resolveValueLabel(option))
      setIsOpen(false)
    },
    [onChange, resolveValueLabel],
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
      setInputValue(resolveValueLabel(value))
    }
  }

  const selectedKey = value ? getOptionKey(value) : null

  return (
    <div className={className} ref={containerRef}>
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
            <li className="account-autocomplete__empty">{emptyMessage}</li>
          ) : (
            filteredOptions.map((option, index) => {
              const key = getOptionKey(option)
              return (
                <li
                  key={key}
                  role="option"
                  aria-selected={selectedKey !== null && key === selectedKey}
                  className={`account-autocomplete__option${
                    index === highlightedIndex
                      ? ' account-autocomplete__option--highlighted'
                      : ''
                  }`}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onClick={() => selectOption(option)}
                >
                  {getOptionLabel(option)}
                </li>
              )
            })
          )}
        </ul>
      )}
    </div>
  )
}

export default Autocomplete
