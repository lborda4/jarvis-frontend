export interface SiigoCostCenterOption {
  id: number
  code: string
  name: string
}

export const NONE_COST_CENTER_OPTION: SiigoCostCenterOption = {
  id: -1,
  code: '',
  name: 'Ninguno',
}

export function isNoneCostCenterOption(
  option: SiigoCostCenterOption | null | undefined,
): boolean {
  return !option || option.id === NONE_COST_CENTER_OPTION.id
}

export function formatCostCenterOptionLabel(
  option: SiigoCostCenterOption,
): string {
  if (isNoneCostCenterOption(option)) {
    return 'Ninguno'
  }

  return `${option.code} - ${option.name}`
}

export function findCostCenterById(
  options: SiigoCostCenterOption[],
  id: number | null | undefined,
): SiigoCostCenterOption {
  if (
    id === null ||
    id === undefined ||
    !Number.isFinite(id) ||
    id === NONE_COST_CENTER_OPTION.id
  ) {
    return NONE_COST_CENTER_OPTION
  }

  return options.find((option) => option.id === id) ?? NONE_COST_CENTER_OPTION
}
