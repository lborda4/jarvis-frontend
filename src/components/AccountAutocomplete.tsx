import { useCallback } from 'react'
import Autocomplete from './Autocomplete'
import {
  formatAccountOptionLabel,
  SIIGO_ACCOUNT_CATALOG,
  type SiigoAccountOption,
} from '../constants/siigoAccountCatalog'

interface AccountAutocompleteProps {
  id?: string
  value: SiigoAccountOption | null
  onChange: (account: SiigoAccountOption | null) => void
  disabled?: boolean
  placeholder?: string
  options?: SiigoAccountOption[]
  suggestedCode?: string | null
}

function AccountAutocomplete({
  id,
  value,
  onChange,
  disabled = false,
  placeholder = 'Buscar cuenta por código o descripción',
  options = SIIGO_ACCOUNT_CATALOG,
  suggestedCode = null,
}: AccountAutocompleteProps) {
  const formatValueLabel = useCallback(
    (account: SiigoAccountOption | null) => {
      if (!account) return ''

      const label = formatAccountOptionLabel(account)
      return suggestedCode && account.code === suggestedCode ? `★ ${label}` : label
    },
    [suggestedCode],
  )

  const isOptionMatch = useCallback(
    (account: SiigoAccountOption, query: string) => {
      const label = formatAccountOptionLabel(account).toLowerCase()
      return (
        label.includes(query) ||
        account.code.includes(query) ||
        account.description.toLowerCase().includes(query)
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
      emptyMessage="No se encontraron cuentas"
      getOptionKey={(account) => account.code}
      getOptionLabel={formatAccountOptionLabel}
      formatValueLabel={formatValueLabel}
      isOptionMatch={isOptionMatch}
    />
  )
}

export default AccountAutocomplete
