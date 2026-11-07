import { describe, expect, it } from 'vitest'
import type { ProductResponse } from '../services/productService'
import { getSalesInvoicePrices } from './salesInvoicePrices'

const product: ProductResponse = {
  id: 'product', sku: 'P1', name: 'Producto', kind: 'product', unit: '94',
  categoryId: null, categoryName: null, description: null,
  priceIncludesIva: false,
  taxes: [{ id: 'iva', code: '1', name: 'IVA', tax_type: 'IVA', rate: 19 }],
  priceLists: [
    { id: 'third', position: 3, name: 'Especial', price: 8330, enabled: true },
    { id: 'first', position: 1, name: 'General', price: 11900, enabled: true },
    { id: 'second', position: 2, name: 'Mayorista', price: 9520, enabled: true },
  ],
}

describe('precios del producto en factura de venta', () => {
  it('usa el orden configurado, conserva los tres precios y no modifica el producto', () => {
    expect(getSalesInvoicePrices(product)).toEqual([
      { id: 'first', name: 'General', unitValue: '11900' },
      { id: 'second', name: 'Mayorista', unitValue: '9520' },
      { id: 'third', name: 'Especial', unitValue: '8330' },
    ])
    expect(product.priceLists[0].id).toBe('third')
  })

  it('descuenta el IVA incluido de todas las opciones para evitar cobrarlo dos veces', () => {
    expect(getSalesInvoicePrices({ ...product, priceIncludesIva: true })
      .map((price) => price.unitValue)).toEqual(['10000', '8000', '7000'])
  })

  it('excluye los precios deshabilitados y conserva los precios en cero', () => {
    expect(getSalesInvoicePrices({ ...product, priceLists: [
      { ...product.priceLists[0], enabled: false },
      { ...product.priceLists[1], price: 0 },
    ] })).toEqual([{ id: 'first', name: 'General', unitValue: '0' }])
    expect(getSalesInvoicePrices({ ...product, priceLists: [] })).toEqual([])
  })
})
