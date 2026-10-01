import { describe, expect, it } from 'vitest'
import { balancePayments, type PaymentEntry } from './paymentBalance'

describe('distribución de pagos', () => {
  const first: PaymentEntry = { id: 'first', methodId: 'cash', amount: '0', automatic: true }
  it('actualiza el pago único con el total del documento', () => {
    expect(balancePayments([first], 23800)[0].amount).toBe('23800.00')
    expect(balancePayments([first], 35700)[0].amount).toBe('35700.00')
  })
  it('crea el saldo restante al reducir el importe', () => {
    const result = balancePayments([{ ...first, automatic: false, amount: '10000' }], 23800)
    expect(result.map(payment => payment.amount)).toEqual(['10000', '13800.00'])
    expect(result[1].methodId).toBe('')
    expect(result[1].automatic).toBe(true)
  })
  it('mantiene el método del saldo y reajusta solo el importe automático', () => {
    const result = balancePayments([{ ...first, automatic: false, amount: '10000' }, { id: 'rest', methodId: 'card', amount: '13800', automatic: true }], 30000)
    expect(result[1]).toMatchObject({ id: 'rest', methodId: 'card', amount: '20000.00' })
  })
  it('permite repartir el saldo en más pagos con identificadores distintos', () => {
    const entries = balancePayments([{ ...first, automatic: false, amount: '10' }], 30)
    const result = balancePayments(entries.map(entry => entry.automatic ? { ...entry, amount: '5', automatic: false } : entry), 30)
    expect(result.map(entry => entry.amount)).toEqual(['10', '5', '15.00'])
    expect(new Set(result.map(entry => entry.id)).size).toBe(3)
  })
  it('elimina el saldo vacío sin ocultar un importe mayor al total', () => {
    expect(balancePayments([{ ...first, amount: '100', automatic: false }], 100)).toHaveLength(1)
    expect(balancePayments([{ ...first, amount: '101', automatic: false }], 100)[0].amount).toBe('101')
  })
  it('calcula en centavos y soporta vaciar el importe mientras se escribe', () => {
    expect(balancePayments([{ ...first, automatic: false, amount: '0.1' }], 0.3)[1].amount).toBe('0.20')
    expect(balancePayments([{ ...first, automatic: false, amount: '' }], 100)[1].amount).toBe('100.00')
  })
})
