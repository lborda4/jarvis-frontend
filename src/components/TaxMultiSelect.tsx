import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  formatTaxOptionLabel,
  type SiigoTaxOption,
} from '../constants/siigoTaxCatalog'

interface TaxMultiSelectProps {
  id?: string
  options: SiigoTaxOption[]
  selectedTaxes: SiigoTaxOption[]
  onChange: (taxes: SiigoTaxOption[]) => void
  disabled?: boolean
  placeholder?: string
}

function getTaxTypeLabel(type: string): string {
  if (type === 'Retefuente') return 'Retefuente'
  if (type === 'ReteICA') return 'ReteICA'
  return type
}

function TaxMultiSelect({
  id,
  options,
  selectedTaxes,
  onChange,
  disabled = false,
  placeholder = 'Buscar retención...',
}: TaxMultiSelectProps) {
  const listboxId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const [inputValue, setInputValue] = useState('')
  const [isOpen, setIsOpen] = useState(false)

  const selectedIds = useMemo(
    () => new Set(selectedTaxes.map((tax) => tax.id)),
    [selectedTaxes],
  )

  const filteredOptions = useMemo(() => {
    const query = inputValue.trim().toLowerCase()

    if (!query) {
      return options
    }

    return options.filter((tax) => {
      const label = formatTaxOptionLabel(tax).toLowerCase()
      return (
        label.includes(query) ||
        String(tax.id).includes(query) ||
        tax.name.toLowerCase().includes(query) ||
        tax.type.toLowerCase().includes(query)
      )
    })
  }, [inputValue, options])

  const groupedOptions = useMemo(() => {
    const groups = new Map<string, SiigoTaxOption[]>()

    for (const tax of filteredOptions) {
      const groupLabel = getTaxTypeLabel(tax.type)
      const current = groups.get(groupLabel) ?? []
      current.push(tax)
      groups.set(groupLabel, current)
    }

    return [...groups.entries()]
  }, [filteredOptions])

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

  const toggleTax = useCallback(
    (tax: SiigoTaxOption) => {
      if (selectedIds.has(tax.id)) {
        onChange(selectedTaxes.filter((item) => item.id !== tax.id))
        return
      }

      onChange([...selectedTaxes, tax])
    },
    [onChange, selectedIds, selectedTaxes],
  )

  const displayValue = useMemo(() => {
    if (selectedTaxes.length === 0) {
      return 'Seleccionar retenciones...'
    }

    return selectedTaxes.map((tax) => formatTaxOptionLabel(tax)).join(', ')
  }, [selectedTaxes])

  return (
    <div className="supplier-multi-select tax-multi-select" ref={containerRef}>
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
          ▾
        </span>
      </button>

      {isOpen && !disabled && (
        <div id={listboxId} className="supplier-multi-select__panel" role="listbox">
          <div className="supplier-multi-select__search-wrap">
            <span className="supplier-multi-select__search-icon" aria-hidden="true">
              ⌕
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

          <div className="supplier-multi-select__options">
            {groupedOptions.length === 0 ? (
              <p className="supplier-multi-select__empty">
                No se encontraron retenciones
              </p>
            ) : (
              groupedOptions.map(([groupLabel, groupOptions]) => (
                <div key={groupLabel} className="tax-multi-select__group">
                  <p className="tax-multi-select__group-label">{groupLabel}</p>
                  {groupOptions.map((tax) => (
                    <label
                      key={tax.id}
                      className="supplier-multi-select__option"
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(tax.id)}
                        onChange={() => toggleTax(tax)}
                      />
                      <span>{formatTaxOptionLabel(tax)}</span>
                    </label>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default TaxMultiSelect
