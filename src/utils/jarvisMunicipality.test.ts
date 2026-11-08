import { describe, expect, it } from 'vitest'
import { formatMunicipalityLabel, isMunicipalityMatch, matchMunicipalityId } from './jarvisMunicipality'

const cities = [
  { id: 149, code: '11001', name: 'Bogotá, D.C.' },
  { id: 439, code: '05001', name: 'Medellín' },
  { id: 10, code: '05400', name: 'La Unión' },
  { id: 11, code: '76400', name: 'La Unión' },
]
describe('municipios compartidos por terceros y empleados', () => {
  it('muestra nombre y código DANE, y busca sin depender de tildes', () => {
    expect(formatMunicipalityLabel(cities[0])).toBe('Bogotá, D.C. (11001)')
    expect(isMunicipalityMatch(cities[1], 'medellin')).toBe(true)
    expect(isMunicipalityMatch(cities[1], '05001')).toBe(true)
  })
  it('convierte el código DANE en el ID interno sin confundirlos', () => {
    expect(matchMunicipalityId(cities, '11001')).toBe(149)
    expect(matchMunicipalityId(cities, '5001')).toBe(439)
    expect(matchMunicipalityId(cities, '149')).toBeUndefined()
  })
  it('acepta un ID interno únicamente si existe en el catálogo', () => {
    expect(matchMunicipalityId(cities, null, null, 149)).toBe(149)
    expect(matchMunicipalityId(cities, null, null, 11001)).toBeUndefined()
    expect(matchMunicipalityId(cities, '11001', null, 439)).toBeUndefined()
  })
  it('normaliza Bogotá y los nombres sin acentos', () => {
    expect(matchMunicipalityId(cities, null, 'BOGOTA')).toBe(149)
    expect(matchMunicipalityId(cities, null, 'Bogotá DC')).toBe(149)
    expect(matchMunicipalityId(cities, null, 'medellin')).toBe(439)
  })
  it('no elige arbitrariamente entre ciudades homónimas', () => {
    expect(matchMunicipalityId(cities, null, 'LA UNION')).toBeUndefined()
    expect(matchMunicipalityId(cities, null, 'LA UNION', null, '05')).toBe(10)
    expect(matchMunicipalityId(cities, null, 'LA UNION', null, '76')).toBe(11)
  })
  it('solo acepta coincidencias parciales únicas y de palabras completas', () => {
    expect(matchMunicipalityId([{ id: 1, code: '05001', name: 'Medellín, Antioquia' }], null, 'Medellin')).toBe(1)
    expect(matchMunicipalityId(cities, null, 'Union')).toBeUndefined()
    expect(matchMunicipalityId(cities, null, 'Med')).toBeUndefined()
    expect(matchMunicipalityId(cities, null, 'Ciudad desconocida')).toBeUndefined()
  })
})
