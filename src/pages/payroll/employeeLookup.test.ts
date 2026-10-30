import { describe, expect, it } from 'vitest'
import { employeeNamesFromFullName } from './employeeLookup'

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
