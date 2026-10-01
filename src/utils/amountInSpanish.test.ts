import { describe, expect, it } from 'vitest'
import { amountInSpanish } from './amountInSpanish'
describe('invoice amount in words', () => {
  it.each([
    [0, 'cero pesos colombianos con 00/100'], [1, 'un peso colombiano con 00/100'],
    [214.2, 'doscientos catorce pesos colombianos con 20/100'],
    [21000, 'veintiún mil pesos colombianos con 00/100'],
    [1000000, 'un millón de pesos colombianos con 00/100'],
    [485310, 'cuatrocientos ochenta y cinco mil trescientos diez pesos colombianos con 00/100'],
  ])('formats %s', (amount, expected) => expect(amountInSpanish(amount as number, 'COP')).toBe(expected))
})
