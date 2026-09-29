import { describe, expect, it } from 'vitest'
import { formatMoneyInput, parseMoneyInput } from './moneyInput'

describe('monetary input', () => {
  it.each([
    ['41000', '41000', '41.000'],
    ['41.000,50', '41000.50', '41.000,50'],
    ['0,', '0.', '0,'],
    [',5', '0.5', '0,5'],
    ['', '', ''],
    ['$ 1.234.567,89', '1234567.89', '1.234.567,89'],
  ])('preserves the amount typed as %s', (input, canonical, display) => {
    expect(parseMoneyInput(input)).toBe(canonical)
    expect(formatMoneyInput(canonical)).toBe(display)
  })
  it('pads cents without changing the amount', () => {
    expect(formatMoneyInput('41000', true)).toBe('41.000,00')
    expect(formatMoneyInput('0.5', true)).toBe('0,50')
    expect(formatMoneyInput('', true)).toBe('')
  })
})
