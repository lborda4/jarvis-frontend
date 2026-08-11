import { useCallback } from 'react'
import Autocomplete from './Autocomplete'
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
  const isOptionMatch = useCallback((tax: SiigoTaxOption, query: string) => {
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
      onChange={onChange}
      options={options}
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
