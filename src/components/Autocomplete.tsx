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
  clearLabel?: string
  selectOnFocus?: boolean
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
  clearLabel,
  selectOnFocus = false,
}: AutocompleteProps<T>) {
  const listboxId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [inputValue, setInputValue] = useState(() =>
    formatValueLabel ? formatValueLabel(value) : value ? getOptionLabel(value) : '',
  )
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

  const selectedLabel = resolveValueLabel(value)
  const selectedValueKey = value ? getOptionKey(value) : null
  const [previousSelection, setPreviousSelection] = useState({ key: selectedValueKey, label: selectedLabel })
  if (previousSelection.key !== selectedValueKey || previousSelection.label !== selectedLabel) {
    setPreviousSelection({ key: selectedValueKey, label: selectedLabel })
    setInputValue(selectedLabel)
  }

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

  const activeHighlightedIndex = Math.min(highlightedIndex, Math.max(0, filteredOptions.length - 1))

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
      setHighlightedIndex(0)
    },
    [onChange, resolveValueLabel],
  )

  const handleInputChange = (nextValue: string) => {
    setInputValue(nextValue)
    setIsOpen(true)
    setHighlightedIndex(0)

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

    if (event.key === 'Enter' && isOpen && filteredOptions[activeHighlightedIndex]) {
      event.preventDefault()
      selectOption(filteredOptions[activeHighlightedIndex])
      return
    }

    if (event.key === 'Escape') {
      setIsOpen(false)
      setInputValue(resolveValueLabel(value))
    }
  }

  const selectedKey = value ? getOptionKey(value) : null

  return (
    <div className={`${className}${clearLabel ? ' account-autocomplete--clearable' : ''}`} ref={containerRef}>
      <input
        ref={inputRef}
        id={id}
        type="text"
        className="account-autocomplete__input"
        value={inputValue}
        onChange={(event) => handleInputChange(event.target.value)}
        onFocus={(event) => {
          if (disabled) return
          setIsOpen(true)
          setHighlightedIndex(0)
          if (selectOnFocus) event.target.select()
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-autocomplete="list"
        autoComplete="off"
      />

      {clearLabel && !disabled && (value || inputValue) && (
        <button
          type="button"
          className="account-autocomplete__clear"
          aria-label={clearLabel}
          title={clearLabel}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            onChange(null)
            setInputValue('')
            setIsOpen(true)
            setHighlightedIndex(0)
            inputRef.current?.focus()
          }}
        >
          <span aria-hidden="true">×</span>
        </button>
      )}

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
                    index === activeHighlightedIndex
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
