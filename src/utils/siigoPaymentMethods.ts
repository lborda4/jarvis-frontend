import type { SiigoPaymentMethodOption } from '../constants/siigoPaymentMethodCatalog'
import type { SiigoPaymentMethodCatalogItem } from '../types/siigo'

/** El medio de pago requiere fecha de vencimiento (crédito) según el catálogo SIIGO. */
export function isCreditPaymentMethod(
  paymentMethod: SiigoPaymentMethodOption | null | undefined,
): boolean {
  return paymentMethod?.dueDate === true
}

export function mapCatalogItemToPaymentMethodOption(
  item: SiigoPaymentMethodCatalogItem,
): SiigoPaymentMethodOption {
  return {
    id: item.id,
    name: item.name,
    type: item.type,
    dueDate: item.dueDate,
  }
}

export function mapSuggestedPaymentMethodToOption(
  paymentMethod: {
    id: number
    name: string
    type: string
    dueDate?: boolean
  } | null | undefined,
): SiigoPaymentMethodOption | null {
  if (!paymentMethod?.id) {
    return null
  }

  return {
    id: paymentMethod.id,
    name: paymentMethod.name,
    type: paymentMethod.type,
    dueDate: Boolean(paymentMethod.dueDate),
  }
}

export function mapCatalogToPaymentMethodOptions(
  items: SiigoPaymentMethodCatalogItem[],
): SiigoPaymentMethodOption[] {
  return items.map(mapCatalogItemToPaymentMethodOption)
}
