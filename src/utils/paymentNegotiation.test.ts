import { describe, expect, it } from 'vitest'
import type { JarvisPaymentMethod } from '../services/jarvisPaymentMethodService'
import { alignPaymentMethods, paymentMethodsForNegotiation } from './paymentNegotiation'

const names = ['Efectivo', 'Crédito clientes', 'Transferencia bancaria', 'Tarjeta crédito', 'Tarjeta débito', 'Otros', 'Crédito proveedores', 'Cuentas por cobrar']
const methods: JarvisPaymentMethod[] = names.map((name, index) => ({ id: String(index), name, nextpymeMethodId: index + 1, nextpymeMethodName: 'Otro' }))

describe('medios de pago por negociación', () => {
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
