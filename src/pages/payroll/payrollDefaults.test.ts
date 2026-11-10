import { expect, it } from 'vitest'
import { blankEmployee, blankParameters, currency, monthlyHoursForWeek, payrollParametersForSettings } from './payrollDefaults'

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

it('precarga el salario mínimo de 2026 sin sumar el auxilio de transporte', () => {
  expect(payrollParametersForSettings(undefined, '2026-10-27').minimumSalary).toBe('1750905')
  expect(payrollParametersForSettings(undefined, '2026-10-27').transportAllowance).toBe('249095')
})

it('conserva el salario personalizado y los demás parámetros guardados', () => {
  const saved = { ...blankParameters('2026-01-01'), minimumSalary: '1900000', transportAllowance: '270000', monthlyHours: '220' }
  expect(payrollParametersForSettings(saved, '2026-10-27')).toEqual(saved)
})

it('propone los valores vigentes cuando los guardados son inferiores a los de este año', () => {
  const saved = { ...blankParameters('2026-01-01'), minimumSalary: '1000000', transportAllowance: '100000' }
  expect(payrollParametersForSettings(saved, '2026-10-29')).toMatchObject({ minimumSalary: '1750905', transportAllowance: '249095' })
  expect(saved).toMatchObject({ minimumSalary: '1000000', transportAllowance: '100000' })
})

it.each(['0', ''])('precarga el salario cuando el valor inicial guardado es %s', minimumSalary => {
  const saved = { ...blankParameters('2026-01-01'), minimumSalary }
  expect(payrollParametersForSettings(saved, '2026-10-27').minimumSalary).toBe('1750905')
  expect(saved.minimumSalary).toBe(minimumSalary)
})

it('no reutiliza la tarifa de 2026 para un año sin valor configurado', () => {
  expect(payrollParametersForSettings(undefined, '2027-01-01').minimumSalary).toBe('0')
  expect(payrollParametersForSettings(undefined, '2027-01-01').transportAllowance).toBe('0')
})

it.each(['0', ''])('precarga el auxilio cuando el valor inicial guardado es %s', transportAllowance => {
  const saved = { ...blankParameters('2026-01-01'), transportAllowance }
  expect(payrollParametersForSettings(saved, '2026-10-27').transportAllowance).toBe('249095')
  expect(saved.transportAllowance).toBe(transportAllowance)
})

it('propone 42 horas semanales y calcula la base mensual que exige la nómina', () => {
  const parameters = payrollParametersForSettings(undefined, '2026-10-27')
  expect(parameters.weeklyHours).toBe('42')
  expect(parameters.monthlyHours).toBe('210')
  expect(monthlyHoursForWeek('40')).toBe('200')
})

it('aplica el cambio de jornada de julio y respeta una jornada personalizada', () => {
  expect(blankParameters('2026-07-14').weeklyHours).toBe('44')
  expect(blankParameters('2026-07-15').weeklyHours).toBe('42')
  const saved = { ...blankParameters('2026-10-01'), weeklyHours: '40', monthlyHours: '' }
  expect(payrollParametersForSettings(saved, '2026-10-27')).toMatchObject({ weeklyHours: '40', monthlyHours: '200' })
})

it('muestra los importes de nómina en pesos con símbolo, miles y dos decimales', () => {
  expect(currency('1750905')).toMatch(/\$\s*1\.750\.905,00/)
  expect(currency('249095.5')).toMatch(/\$\s*249\.095,50/)
})
