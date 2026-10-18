import { describe, expect, it } from 'vitest'
import type { JarvisPaymentMethod } from '../services/jarvisPaymentMethodService'
import { alignPaymentMethods, paymentMethodsForNegotiation, buildPaymentBreakdown, primaryPaymentForNegotiation } from './paymentNegotiation'

const names = ['Efectivo', 'Crédito clientes', 'Transferencia bancaria', 'Tarjeta crédito', 'Tarjeta débito', 'Otros', 'Crédito proveedores', 'Cuentas por cobrar']
const methods: JarvisPaymentMethod[] = names.map((name, index) => ({ id: String(index), name, nextpymeMethodId: index + 1, nextpymeMethodName: 'Otro' }))

describe('medios de pago por negociación', () => {
  it('permite efectivo, transferencia y saldo a crédito sin cambiar los medios elegidos', () => {
    const entries = [
      { id: 'cash', methodId: '0', amount: '100' },
      { id: 'transfer', methodId: '2', amount: '50' },
      { id: 'credit', methodId: '1', amount: '200', automatic: true },
    ]
    const available = paymentMethodsForNegotiation(methods, true, true)
    expect(alignPaymentMethods(entries, available)).toEqual(entries)
    const breakdown = buildPaymentBreakdown(entries, available)
    expect(breakdown.map(payment => [payment.methodName, payment.negotiation, payment.amount])).toEqual([
      ['Efectivo', 'CASH', 100], ['Transferencia bancaria', 'CASH', 50], ['Crédito clientes', 'CREDIT', 200],
    ])
    expect(primaryPaymentForNegotiation(entries, methods, true)?.id).toBe('credit')
    expect(primaryPaymentForNegotiation(entries, methods, false)?.id).toBe('cash')
  })
  it('no considera tarjeta crédito como saldo pendiente ni incluye importes en cero', () => {
    const entries = [{ id: 'card', methodId: '3', amount: '99.99' }, { id: 'credit', methodId: '1', amount: '0' }]
    expect(primaryPaymentForNegotiation(entries, methods, true)).toBeUndefined()
    expect(buildPaymentBreakdown(entries, methods)).toEqual([expect.objectContaining({ negotiation: 'CASH', amount: 99.99 })])
    expect(() => buildPaymentBreakdown([{ id: 'bad', methodId: 'unknown', amount: '1' }], methods)).toThrow('Selecciona una forma')
  })
  it('prioriza la negociación guardada sobre el nombre del medio', () => {
    const explicit: JarvisPaymentMethod[] = [
      { ...methods[0], negotiation: 'CREDIT' },
      { ...methods[1], negotiation: 'CASH' },
    ]
    expect(paymentMethodsForNegotiation(explicit, true)).toEqual([explicit[0]])
    expect(paymentMethodsForNegotiation(explicit, false)).toEqual([explicit[1]])
  })
  it('separa el crédito al cliente de las tarjetas y transferencias', () => {
    expect(paymentMethodsForNegotiation(methods, true).map(method => method.name)).toEqual(['Crédito clientes', 'Crédito proveedores', 'Cuentas por cobrar'])
    expect(paymentMethodsForNegotiation(methods, false).map(method => method.name)).toEqual(['Efectivo', 'Transferencia bancaria', 'Tarjeta crédito', 'Tarjeta débito', 'Otros'])
  })
  it('cambia los medios incompatibles conservando los importes y el saldo automático', () => {
    const entries = [{ id: 'a', methodId: '0', amount: '100' }, { id: 'b', methodId: '3', amount: '50', automatic: true }]
    const credit = alignPaymentMethods(entries, paymentMethodsForNegotiation(methods, true))
    expect(credit).toEqual(entries.map(entry => ({ ...entry, methodId: '1' })))
    expect(alignPaymentMethods(credit, paymentMethodsForNegotiation(methods, false))).toEqual(entries.map(entry => ({ ...entry, methodId: '0' })))
  })
  it('mantiene selecciones compatibles y deja vacío si no hay un medio disponible', () => {
    const entries = [{ id: 'a', methodId: '3', amount: '10' }, { id: 'b', methodId: '', amount: '20' }]
    expect(alignPaymentMethods(entries, paymentMethodsForNegotiation(methods, false))).toEqual(entries)
    expect(alignPaymentMethods(entries, []).every(entry => entry.methodId === '')).toBe(true)
  })
})
