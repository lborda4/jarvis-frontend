import { describe, expect, it } from 'vitest'
import { resolvePurchaseCreditFallbackPaymentMethod } from './siigoPaymentMethods'

const OPTIONS = [
  { id: 1, name: 'Efectivo', type: 'Cash', dueDate: false },
  { id: 9187, name: 'Crédito proveedores', type: 'Credit', dueDate: true },
  { id: 9188, name: 'Otras cuentas por pagar', type: 'Credit', dueDate: true },
]

describe('resolvePurchaseCreditFallbackPaymentMethod', () => {
  it('cuenta clase 5 usa Otras cuentas por pagar', () => {
    expect(resolvePurchaseCreditFallbackPaymentMethod('51359501', OPTIONS)?.id).toBe(
      9188,
    )
  })

  it.each(['11050501', '61350501', '71050501', null])(
    'cuenta %s usa Crédito proveedores',
    (accountCode) => {
      expect(
        resolvePurchaseCreditFallbackPaymentMethod(accountCode, OPTIONS)?.id,
      ).toBe(9187)
    },
  )
})
