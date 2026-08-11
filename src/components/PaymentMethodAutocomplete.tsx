import { useCallback } from 'react'
import Autocomplete from './Autocomplete'
import {
  formatPaymentMethodOptionLabel,
  type SiigoPaymentMethodOption,
} from '../constants/siigoPaymentMethodCatalog'

interface PaymentMethodAutocompleteProps {
  id?: string
  value: SiigoPaymentMethodOption | null
  onChange: (paymentMethod: SiigoPaymentMethodOption | null) => void
  disabled?: boolean
  placeholder?: string
  options?: SiigoPaymentMethodOption[]
}

function PaymentMethodAutocomplete({
  id,
  value,
  onChange,
  disabled = false,
  placeholder = 'Buscar medio de pago...',
  options = [],
}: PaymentMethodAutocompleteProps) {
  const isOptionMatch = useCallback(
    (paymentMethod: SiigoPaymentMethodOption, query: string) => {
      const label = formatPaymentMethodOptionLabel(paymentMethod).toLowerCase()
      return (
        label.includes(query) ||
        String(paymentMethod.id).includes(query) ||
        paymentMethod.name.toLowerCase().includes(query)
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
      emptyMessage="No se encontraron medios de pago"
      getOptionKey={(paymentMethod) => paymentMethod.id}
      getOptionLabel={formatPaymentMethodOptionLabel}
      isOptionMatch={isOptionMatch}
    />
  )
}

export default PaymentMethodAutocomplete
