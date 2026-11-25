import { describe, expect, it } from 'vitest'
import { isValidPurchaseOrder } from './purchaseOrder'

describe('orden de compra', () => {
  it('permite omitirla o completar todos los datos', () => {
    expect(isValidPurchaseOrder({ prefix: '', consecutive: '', issueDate: '' })).toBe(true)
    expect(isValidPurchaseOrder({ prefix: 'OC-', consecutive: '00123', issueDate: '2024-02-29' })).toBe(true)
  })

  it.each([
    { prefix: 'OC-', consecutive: '', issueDate: '' },
    { prefix: '', consecutive: '1', issueDate: '2024-01-10' },
    { prefix: 'OC-', consecutive: '1', issueDate: '' },
    { prefix: 'OC-', consecutive: '1', issueDate: '2023-02-29' },
    { prefix: 'OC-', consecutive: '1', issueDate: '10/01/2024' },
  ])('rechaza datos incompletos o fecha inválida: %j', order => {
    expect(isValidPurchaseOrder(order)).toBe(false)
  })
})
