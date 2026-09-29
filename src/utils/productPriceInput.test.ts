import { expect, it } from 'vitest'
import { parseProductPrice } from './productPriceInput'

it('conserva los decimales de un precio guardado al editarlo', () => {
  for (const price of [500, 1250.5, 1234567.89]) {
    expect(parseProductPrice(price.toLocaleString('es-CO', { maximumFractionDigits: 2 }))).toBe(price)
  }
})

it('acepta precios nuevos sin separadores y rechaza separadores decimales repetidos', () => {
  expect(parseProductPrice('1250,50')).toBe(1250.5)
  expect(parseProductPrice('50000')).toBe(50000)
  expect(parseProductPrice('1,2,3')).toBeNaN()
})
