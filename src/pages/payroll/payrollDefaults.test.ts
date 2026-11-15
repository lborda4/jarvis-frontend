import { expect, it } from 'vitest'
import { blankEmployee, currency } from './payrollDefaults'

it('deja la fecha de ingreso vacía al crear un empleado para que el usuario la seleccione', () => {
  expect(blankEmployee().admittanceDate).toBe('')
  expect(blankEmployee([{ id: 3, name: 'Cédula de ciudadanía' }]).admittanceDate).toBe('')
})

it('selecciona Cédula de ciudadanía con su ID del catálogo de nómina aunque el NIT aparezca primero', () => {
  const employee = blankEmployee([
    { id: 6, name: 'NIT', code: '31' },
    { id: 273, name: 'Cédula de ciudadanía', code: '13' },
    { id: 9, name: 'Cédula de extranjería', code: '22' },
  ])
  expect(employee.documentTypeId).toBe(273)
})

it('reconoce variantes del nombre y no inventa un ID si falta la cédula en el catálogo', () => {
  expect(blankEmployee([{ id: 72, name: 'CÉDULA  DE CIUDADANÍA' }]).documentTypeId).toBe(72)
  expect(blankEmployee([{ id: 6, name: 'NIT', code: '31' }]).documentTypeId).toBe(0)
  expect(blankEmployee([{ id: 91, name: 'CC', code: 'CC' }]).documentTypeId).toBe(91)
})

it('inicia empleados nuevos con el salario mínimo legal sin sumar auxilio de transporte', () => {
  const employee = blankEmployee([], '2026-10-28')
  expect(employee.salary).toBe('1750905')
  expect(currency(employee.salary)).toMatch(/\$\s*1\.750\.905,00/)
})

it('permite cambiar el salario de un empleado sin alterar el valor inicial del siguiente', () => {
  const employee = blankEmployee([], '2026-10-28')
  employee.salary = '3000000'
  expect(blankEmployee([], '2026-10-28').salary).toBe('1750905')
  expect(employee.salary).toBe('3000000')
})

it('muestra los importes de nómina en pesos con símbolo, miles y dos decimales', () => {
  expect(currency('1750905')).toMatch(/\$\s*1\.750\.905,00/)
  expect(currency('249095.5')).toMatch(/\$\s*249\.095,50/)
})
