import { useCallback, useMemo } from 'react'
import Autocomplete from './Autocomplete'
import {
  formatCostCenterOptionLabel,
  NONE_COST_CENTER_OPTION,
  isNoneCostCenterOption,
  type SiigoCostCenterOption,
} from '../constants/siigoCostCenterCatalog'

interface CostCenterAutocompleteProps {
  id?: string
  value: SiigoCostCenterOption | null
  onChange: (costCenter: SiigoCostCenterOption) => void
  disabled?: boolean
  placeholder?: string
  options?: SiigoCostCenterOption[]
}

function CostCenterAutocomplete({
  id,
  value,
  onChange,
  disabled = false,
  placeholder = 'Ninguno',
  options = [],
}: CostCenterAutocompleteProps) {
  const resolvedValue = isNoneCostCenterOption(value) ? NONE_COST_CENTER_OPTION : value

  const optionsWithNone = useMemo(
    () => [
      NONE_COST_CENTER_OPTION,
      ...options.filter((option) => !isNoneCostCenterOption(option)),
    ],
    [options],
  )

  const isOptionMatch = useCallback(
    (costCenter: SiigoCostCenterOption, query: string) => {
      if (isNoneCostCenterOption(costCenter)) {
        return formatCostCenterOptionLabel(NONE_COST_CENTER_OPTION)
          .toLowerCase()
          .includes(query)
      }

      const label = formatCostCenterOptionLabel(costCenter).toLowerCase()
      return (
        label.includes(query) ||
        String(costCenter.id).includes(query) ||
        costCenter.code.toLowerCase().includes(query) ||
        costCenter.name.toLowerCase().includes(query)
      )
    },
    [],
  )

  return (
    <Autocomplete
      id={id}
      value={resolvedValue}
      onChange={(next) => onChange(next ?? NONE_COST_CENTER_OPTION)}
      options={optionsWithNone}
      disabled={disabled}
      placeholder={placeholder}
      emptyMessage="No se encontraron centros de costo"
      getOptionKey={(costCenter) => costCenter.id}
      getOptionLabel={formatCostCenterOptionLabel}
      isOptionMatch={isOptionMatch}
    />
  )
}

export default CostCenterAutocomplete
