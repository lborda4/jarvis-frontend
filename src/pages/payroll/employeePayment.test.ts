import { expect, it } from 'vitest'
import { employeeBankFields, employeePaymentType } from './employeePayment'

const methods = [{ id: 100, name: 'Efectivo', code: '10' }, { id: 420, name: 'Transferecia Crédito', code: '30' }]
it('identifica el medio por el catálogo real sin confundir IDs con códigos', () => {
  expect(employeePaymentType(100, methods)).toBe('cash')
  expect(employeePaymentType(420, methods)).toBe('transfer')
  expect(employeePaymentType(42, methods)).toBeUndefined()
  expect(employeePaymentType(7, [{ id: 7, name: 'Consignación bancaria' }])).toBe('transfer')
  expect(employeePaymentType(42, [{ id: 42, name: 'Transferecia Crédito', code: null }])).toBe('transfer')
})
it('limpia espacios, conserva ceros iniciales y quita datos bancarios en efectivo', () => {
  const fields = { bankName: ' Banco Ejemplo ', accountType: ' ahorros ', accountNumber: ' 00123456 ' }
  expect(employeeBankFields(fields, 'transfer')).toEqual({ bankName: 'Banco Ejemplo', accountType: 'AHORROS', accountNumber: '00123456' })
  expect(employeeBankFields(fields, 'cash')).toEqual({ bankName: '', accountType: '', accountNumber: '' })
})
