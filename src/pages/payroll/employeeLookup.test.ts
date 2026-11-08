import { describe, expect, it } from 'vitest'
import { applyEmployeeLookup, employeeDetailsFromLookup, employeeNamesFromFullName } from './employeeLookup'
import { blankEmployee } from './payrollDefaults'

describe('employeeNamesFromFullName', () => {
  it('respeta el orden de apellidos y nombres de la consulta por cédula', () => {
    expect(employeeNamesFromFullName('BORDA BELTRAN LAURA SOFIA')).toEqual({
      firstName: 'LAURA', secondName: 'SOFIA', surname: 'BORDA', secondSurname: 'BELTRAN',
    })
  })
  it('permite un solo nombre y un solo apellido', () => {
    expect(employeeNamesFromFullName('  Pérez  Ana ')).toEqual({
      firstName: 'Ana', secondName: '', surname: 'Pérez', secondSurname: '',
    })
  })
  it('conserva todas las palabras del nombre recibido', () => {
    const names = employeeNamesFromFullName('PEREZ GOMEZ MARIA DEL PILAR')!
    expect(names).toEqual({ firstName: 'MARIA', secondName: 'DEL PILAR', surname: 'PEREZ', secondSurname: 'GOMEZ' })
  })
  it('permite un solo nombre y dos apellidos', () => {
    expect(employeeNamesFromFullName('PEREZ GOMEZ ANA')).toEqual({
      firstName: 'ANA', secondName: '', surname: 'PEREZ', secondSurname: 'GOMEZ',
    })
  })
  it('no propone datos incompletos', () => {
    expect(employeeNamesFromFullName('')).toBeNull()
    expect(employeeNamesFromFullName('MARIA')).toBeNull()
  })
})

describe('datos de contacto de la consulta del empleado', () => {
  const result = { found: true, name: 'PEREZ GOMEZ ANA', email: '  ana@correo.com  ' }
  const employee = () => ({ ...blankEmployee([], '2026-11-07'), identification: '12345678', documentTypeId: 3 })

  it('autocompleta nombres y correo sin espacios y conserva los demás datos', () => {
    const requested = employee()
    const current = { ...requested, salary: '2000000' }
    expect(applyEmployeeLookup(current, requested, employeeDetailsFromLookup(result))).toEqual({
      ...current, firstName: 'ANA', surname: 'PEREZ', secondSurname: 'GOMEZ', email: 'ana@correo.com',
    })
  })

  it('conserva el correo escrito antes de consultar y el escrito mientras esperaba', () => {
    const requested = { ...employee(), email: 'manual@correo.com' }
    expect(applyEmployeeLookup(requested, requested, employeeDetailsFromLookup(result)).email).toBe('manual@correo.com')
    const blank = employee()
    expect(applyEmployeeLookup({ ...blank, email: 'nuevo@correo.com' }, blank, employeeDetailsFromLookup(result)).email).toBe('nuevo@correo.com')
  })

  it('rellena el correo aunque el usuario haya corregido los nombres durante la consulta', () => {
    const requested = employee()
    const current = { ...requested, firstName: 'Ana María', surname: 'Pérez' }
    expect(applyEmployeeLookup(current, requested, employeeDetailsFromLookup(result))).toEqual({ ...current, email: 'ana@correo.com' })
  })

  it('rellena los nombres aunque el usuario haya escrito el correo durante la consulta', () => {
    const requested = employee()
    const current = { ...requested, email: 'manual@correo.com' }
    expect(applyEmployeeLookup(current, requested, employeeDetailsFromLookup(result))).toMatchObject({ firstName: 'ANA', surname: 'PEREZ', email: 'manual@correo.com' })
  })

  it('acepta una respuesta que solo traiga correo', () => {
    const requested = employee()
    const details = employeeDetailsFromLookup({ ...result, name: null })
    expect(details.names).toBeNull()
    expect(applyEmployeeLookup(requested, requested, details)).toEqual({ ...requested, email: 'ana@correo.com' })
  })

  it.each([null, '', 'sin correo', 'uno@correo.com;dos@correo.com', 'a'.repeat(255) + '@correo.com'])('no autocompleta un correo inválido o ausente: %s', email => {
    const requested = employee()
    const merged = applyEmployeeLookup(requested, requested, employeeDetailsFromLookup({ ...result, email }))
    expect(merged.email).toBe('')
    expect(merged.firstName).toBe('ANA')
  })

  it('ignora datos de una respuesta que no encontró el documento', () => {
    expect(employeeDetailsFromLookup({ ...result, found: false })).toEqual({ names: null, email: '', address: '', municipalityId: undefined })
  })

  it.each([{ identification: '87654321' }, { documentTypeId: 5 }, { id: 'otro-empleado' }])('no aplica una respuesta a otro empleado o documento: %j', changes => {
    const requested = employee()
    const current = { ...requested, ...changes }
    expect(applyEmployeeLookup(current, requested, employeeDetailsFromLookup(result))).toBe(current)
  })

  it('es compatible con empleados anteriores que todavía no tienen correo', () => {
    const requested = employee()
    delete requested.email
    expect(applyEmployeeLookup(requested, requested, employeeDetailsFromLookup(result)).email).toBe('ana@correo.com')
  })
})

describe('ubicación del empleado consultada en NextPyme', () => {
  const employee = () => ({ ...blankEmployee([], '2026-11-07'), identification: '12345678', documentTypeId: 3 })
  const cities = [{ id: 149, code: '11001', name: 'Bogotá, D.C.' }, { id: 439, code: '05001', name: 'Medellín' }]
  const result = { found: true, name: null, email: null, address: '  Calle 1 # 2-3  ', cityCode: '11001' }

  it('completa dirección y ciudad aunque la respuesta no traiga nombres ni correo', () => {
    const requested = employee()
    expect(applyEmployeeLookup(requested, requested, employeeDetailsFromLookup(result, cities))).toEqual({ ...requested, address: 'Calle 1 # 2-3', municipalityId: 149 })
  })
  it('completa la ciudad cuando su catálogo termina de cargar después de la consulta', () => {
    const requested = employee()
    const first = applyEmployeeLookup(requested, requested, employeeDetailsFromLookup(result))
    expect(first.municipalityId).toBe(0)
    expect(applyEmployeeLookup(first, requested, employeeDetailsFromLookup(result, cities))).toMatchObject({ address: 'Calle 1 # 2-3', municipalityId: 149 })
  })
  it('respeta la dirección y ciudad ingresadas antes o durante la consulta', () => {
    const requested = employee()
    const manual = { ...requested, address: 'Carrera 8', municipalityId: 439 }
    expect(applyEmployeeLookup(manual, requested, employeeDetailsFromLookup(result, cities))).toEqual(manual)
    expect(applyEmployeeLookup(manual, manual, employeeDetailsFromLookup(result, cities))).toEqual(manual)
  })
  it('no pierde una selección manual mientras termina de cargar el catálogo', () => {
    const requested = employee()
    const partial = applyEmployeeLookup(requested, requested, employeeDetailsFromLookup(result))
    const edited = { ...partial, municipalityId: 439, address: 'Dirección corregida' }
    expect(applyEmployeeLookup(edited, requested, employeeDetailsFromLookup(result, cities))).toEqual(edited)
  })
  it('conserva la ciudad vacía si el servicio no devuelve una coincidencia válida', () => {
    const requested = employee()
    const details = employeeDetailsFromLookup({ ...result, cityCode: '99999' }, cities)
    expect(applyEmployeeLookup(requested, requested, details)).toMatchObject({ address: 'Calle 1 # 2-3', municipalityId: 0 })
  })
  it('completa empleados antiguos que todavía no tienen campos de ubicación', () => {
    const requested = employee()
    delete requested.address
    delete requested.municipalityId
    expect(applyEmployeeLookup(requested, requested, employeeDetailsFromLookup(result, cities))).toMatchObject({ address: 'Calle 1 # 2-3', municipalityId: 149 })
  })
  it('no usa dirección ni ciudad cuando el documento no fue encontrado o cambió', () => {
    const requested = employee()
    expect(applyEmployeeLookup(requested, requested, employeeDetailsFromLookup({ ...result, found: false }, cities))).toEqual(requested)
    const other = { ...requested, identification: '87654321' }
    expect(applyEmployeeLookup(other, requested, employeeDetailsFromLookup(result, cities))).toBe(other)
  })
})
