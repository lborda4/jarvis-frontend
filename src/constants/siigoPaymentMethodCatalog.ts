export interface SiigoPaymentMethodOption {
  id: number
  name: string
  type?: string
  dueDate?: boolean
}

export function formatPaymentMethodOptionLabel(
  option: SiigoPaymentMethodOption,
): string {
  return option.name
}

export function findPaymentMethodById(
  options: SiigoPaymentMethodOption[],
  id: number | null | undefined,
): SiigoPaymentMethodOption | null {
  if (id === null || id === undefined || !Number.isFinite(id)) {
    return null
  }

  return options.find((option) => option.id === id) ?? null
}
