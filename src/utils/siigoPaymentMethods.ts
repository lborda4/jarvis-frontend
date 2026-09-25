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

const CREDIT_SUPPLIER_NAME_ALIASES = [
  'credito proveedores',
  'credito a proveedores',
] as const

const OTHER_PAYABLES_NAME_ALIASES = ['otras cuentas por pagar'] as const

/** Sin historial: crédito. Cuenta 5 → Otras cuentas por pagar; 1/6/7 u
 * otra/sin cuenta → Crédito proveedores. El id sale del catálogo SIIGO
 * de la empresa (no es un código fijo). */
export function resolvePurchaseCreditFallbackPaymentMethod(
  accountCode: string | null | undefined,
  paymentMethodOptions: SiigoPaymentMethodOption[],
): SiigoPaymentMethodOption | null {
  const accountClass = accountCode?.replace(/[^\d]/g, '')[0] ?? null
  const aliases =
    accountClass === '5'
      ? OTHER_PAYABLES_NAME_ALIASES
      : CREDIT_SUPPLIER_NAME_ALIASES

  return (
    findPaymentMethodByName(paymentMethodOptions, aliases) ??
    paymentMethodOptions.find((option) => option.dueDate === true) ??
    null
  )
}

function findPaymentMethodByName(
  paymentMethodOptions: SiigoPaymentMethodOption[],
  aliases: readonly string[],
): SiigoPaymentMethodOption | null {
  return (
    paymentMethodOptions.find((option) => {
      const normalized = option.name
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')

      return aliases.some(
        (alias) => normalized === alias || normalized.includes(alias),
      )
    }) ?? null
  )
}
