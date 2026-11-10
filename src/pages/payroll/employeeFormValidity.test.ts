import { expect, it } from 'vitest'
import { blankEmployee } from './payrollDefaults'
import { canSavePayrollEmployee } from './employeeFormValidity'
import type { Employee, PayrollWorkerCatalogs } from '../../services/payrollService'

const catalogs: PayrollWorkerCatalogs = {
  identifications: [{ id: 3, name: 'Cédula de ciudadanía' }], workerTypes: [{ id: 1, name: 'Dependiente' }],
  workerSubtypes: [{ id: 1, name: 'No aplica' }], contractTypes: [{ key: 'INDEFINITE', id: 2, name: 'Indefinido' }, { key: 'APPRENTICE', id: 4, name: 'Aprendizaje' }],
  paymentMethods: [{ id: 10, name: 'Efectivo', code: '10' }, { id: 42, name: 'Consignación bancaria', code: '30' }],
}
const cities = [{ id: 149, name: 'Bogotá', code: '11001' }]
const positions = [{ id: 'position', name: 'Analista', code: 'A', salary: '1000', active: true }]
const employee: Employee = { ...blankEmployee([], '2026-11-08'), identification: '12345678', documentTypeId: 3,
  firstName: 'Ana', surname: 'Pérez', address: 'Calle 1', municipalityId: 149, positionId: 'position',
  typeWorkerId: 1, subTypeWorkerId: 1, paymentMethodId: 10, email: '', integralSalary: false }
const valid = (patch: Partial<Employee> = {}) => canSavePayrollEmployee({ ...employee, ...patch }, catalogs, cities, positions)

it('permite guardar sin correo, salario integral, segundo nombre, segundo apellido ni retiro', () => expect(valid()).toBe(true))
it.each<Partial<Employee>>([
  { identification: '' }, { identification: '123' }, { documentTypeId: 0 }, { firstName: ' ' }, { surname: '' },
  { address: '' }, { municipalityId: 0 }, { typeWorkerId: 0 }, { subTypeWorkerId: 0 },
  { contractType: '' }, { admittanceDate: '' }, { admittanceDate: '2026-02-30' }, { salary: '' }, { salary: '0' },
  { paymentMethodId: 0 }, { email: 'correo inválido' }, { retirementDate: '2025-01-01' },
])('deshabilita el guardado con campos incompletos o inválidos: %j', patch => expect(valid(patch)).toBe(false))
it('permite guardar sin cargo ni fecha de retiro, incluso si no hay cargos creados', () => {
  expect(canSavePayrollEmployee({ ...employee, positionId: '', retirementDate: '' }, catalogs, cities, [])).toBe(true)
  expect(valid({ positionId: '', retirementDate: '', paymentMethodId: 42, bankName: 'Banco', accountType: 'AHORROS', accountNumber: '00123' })).toBe(true)
})
it('requiere los datos bancarios solo al elegir consignación y conserva ceros en la cuenta', () => {
  expect(valid({ paymentMethodId: 42 })).toBe(false)
  expect(valid({ paymentMethodId: 42, bankName: 'Banco', accountType: 'AHORROS', accountNumber: '00123' })).toBe(true)
  expect(valid({ paymentMethodId: 42, bankName: 'Banco', accountType: 'AHORROS', accountNumber: 'abc' })).toBe(false)
})
it('requiere modalidad, etapa y fechas válidas para aprendices', () => {
  expect(valid({ contractType: 'APPRENTICE' })).toBe(false)
  expect(valid({ contractType: 'APPRENTICE', stageStart: '2026-11-08', stageEnd: '2027-01-01' })).toBe(true)
})
it('no acepta opciones que no están en las listas cargadas', () => {
  expect(canSavePayrollEmployee(employee, null, cities, positions)).toBe(false)
  expect(canSavePayrollEmployee(employee, catalogs, [], positions)).toBe(false)
  expect(canSavePayrollEmployee(employee, catalogs, cities, [])).toBe(false)
  expect(valid({ documentTypeId: 999 })).toBe(false)
})
