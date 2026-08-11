import { useCallback } from 'react'
import Autocomplete from './Autocomplete'
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
  const isOptionMatch = useCallback((supplier: SupplierOption, query: string) => {
    const label = formatSupplierOptionLabel(supplier).toLowerCase()
    return (
      label.includes(query) ||
      supplier.nit.includes(query) ||
      supplier.name.toLowerCase().includes(query)
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
      emptyMessage="No se encontraron proveedores"
      getOptionKey={(supplier) => supplier.nit}
      getOptionLabel={formatSupplierOptionLabel}
      isOptionMatch={isOptionMatch}
    />
  )
}

export default SupplierAutocomplete
