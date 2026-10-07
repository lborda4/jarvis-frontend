import { useCallback } from 'react'
import Autocomplete from './Autocomplete'
import {
  formatProductOptionLabel,
  type SiigoProductOption,
} from '../constants/siigoProductCatalog'

interface ProductAutocompleteProps {
  id?: string
  value: SiigoProductOption | null
  onChange: (product: SiigoProductOption | null) => void
  disabled?: boolean
  placeholder?: string
  options?: SiigoProductOption[]
  invalid?: boolean
  emptyMessage?: string
}

function ProductAutocomplete({
  id,
  value,
  onChange,
  disabled = false,
  placeholder = 'Buscar producto por código o nombre',
  options = [],
  invalid = false,
  emptyMessage = 'No se encontraron productos',
}: ProductAutocompleteProps) {
  const isOptionMatch = useCallback(
    (product: SiigoProductOption, query: string) => {
      const label = formatProductOptionLabel(product).toLowerCase()
      return (
        label.includes(query) ||
        product.code.includes(query) ||
        product.description.toLowerCase().includes(query)
      )
    },
    [],
  )

  return (
    <Autocomplete
      id={id}
      value={value}
      onChange={onChange}
      options={options}
      disabled={disabled}
      placeholder={placeholder}
      invalid={invalid}
      emptyMessage={emptyMessage}
      getOptionKey={(product) => product.code}
      getOptionLabel={formatProductOptionLabel}
      isOptionMatch={isOptionMatch}
    />
  )
}

export default ProductAutocomplete
