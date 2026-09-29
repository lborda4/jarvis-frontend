import { describe, expect, it } from 'vitest'
import type { JarvisTax } from '../types/jarvis'
import { buildProductTaxOptions, DEFAULT_PRODUCT_IVA } from './productTaxes'

const saved: JarvisTax = { ...DEFAULT_PRODUCT_IVA, id: 'saved-iva', code: '1', is_active: true, is_in_use: false, created_at: '', updated_at: '' }
describe('product default taxes', () => {
  it('offers IVA 19% without configuration', () => {
    expect(buildProductTaxOptions([])).toEqual([DEFAULT_PRODUCT_IVA])
  })
  it('reuses active IVA 19% without duplicating the option', () => {
    expect(buildProductTaxOptions([saved])).toEqual([saved])
  })
  it('keeps other rates and inactive taxes already linked to an edited product', () => {
    const inactive = { ...saved, is_active: false }
    const other = { ...saved, id: 'iva5', rate: 5 }
    expect(buildProductTaxOptions([inactive, other], [inactive.id])).toEqual([inactive, other, DEFAULT_PRODUCT_IVA])
  })
})
