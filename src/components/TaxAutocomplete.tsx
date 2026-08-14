import { useCallback, useMemo } from 'react'
import Autocomplete from './Autocomplete'
import {
  formatTaxOptionLabel,
  isNoneTaxOption,
  NONE_TAX_OPTION,
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
  const optionsWithNone = useMemo(
    () => [NONE_TAX_OPTION, ...options.filter((option) => !isNoneTaxOption(option))],
    [options],
  )

  const isOptionMatch = useCallback((tax: SiigoTaxOption, query: string) => {
    if (isNoneTaxOption(tax)) {
      return formatTaxOptionLabel(NONE_TAX_OPTION).toLowerCase().includes(query)
    }

    const label = formatTaxOptionLabel(tax).toLowerCase()
    return (
      label.includes(query) ||
      String(tax.id).includes(query) ||
      tax.name.toLowerCase().includes(query)
    )
  }, [])

  return (
    <Autocomplete
      id={id}
      value={value}
      onChange={(next) => onChange(isNoneTaxOption(next) ? null : next)}
      options={optionsWithNone}
      disabled={disabled}
      placeholder={placeholder}
      emptyMessage="No se encontraron retenciones"
      getOptionKey={(tax) => tax.id}
      getOptionLabel={formatTaxOptionLabel}
      isOptionMatch={isOptionMatch}
    />
  )
}

export default TaxAutocomplete
