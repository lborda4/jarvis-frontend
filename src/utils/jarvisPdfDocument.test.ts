import { describe, expect, it } from 'vitest'
import { jarvisPdfCopy, jarvisPdfKindFromFlags } from './jarvisPdfDocument'

describe('jarvisPdfCopy', () => {
  it('usa CUDS y proveedor en documento soporte y nota de ajuste', () => {
    expect(jarvisPdfCopy('SUPPORT_DOCUMENT')).toMatchObject({ uniqueCode: 'CUDS', party: 'Proveedor' })
    expect(jarvisPdfCopy('SUPPORT_CREDIT_NOTE')).toMatchObject({ uniqueCode: 'CUDS', shortTitle: 'Nota de ajuste' })
  })
  it('usa CUDE en notas crédito y débito', () => {
    expect(jarvisPdfCopy('CREDIT_NOTE').uniqueCode).toBe('CUDE')
    expect(jarvisPdfCopy('DEBIT_NOTE').uniqueCode).toBe('CUDE')
  })
  it('resuelve el tipo desde las banderas de la pantalla', () => {
    expect(jarvisPdfKindFromFlags({ adjustmentNote: true })).toBe('SUPPORT_CREDIT_NOTE')
    expect(jarvisPdfKindFromFlags({ supportDocument: true })).toBe('SUPPORT_DOCUMENT')
    expect(jarvisPdfKindFromFlags()).toBe('ELECTRONIC_INVOICE')
  })
})
