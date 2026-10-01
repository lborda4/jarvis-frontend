import { describe, expect, it } from 'vitest'
import { filterSuppliers } from './filterSuppliers'

const supplier = { nit: '901464201', name: 'Compañía principal' }
const others = [
  { nit: '1901464201', name: 'Otra empresa' },
  { nit: '9014642010', name: 'Otro proveedor' },
  { nit: '800123456', name: 'Almacén 901464201' },
]
const options = [supplier, ...others]

describe('Búsqueda de proveedores', () => {
  it.each(['901464201', '901.464.201', '901.464.201-3', ' NIT: 901 464 201-3 '])('prioriza el NIT exacto: %s', query => {
    expect(filterSuppliers(options, query)).toEqual([supplier])
  })
  it('reconoce NIT con formato también en el catálogo', () => {
    const formatted = { ...supplier, nit: '901.464.201-3' }
    expect(filterSuppliers([formatted, ...others], supplier.nit)).toEqual([formatted])
  })
  it('busca prefijos del NIT sin mezclar nombres o coincidencias intermedias', () => {
    expect(filterSuppliers(options, '901')).toEqual([supplier, others[1]])
  })
  it('no muestra empresas ajenas cuando el NIT no existe', () => {
    expect(filterSuppliers(options, '999999999')).toEqual([])
  })
  it('permite búsqueda por nombre sin depender de tildes o mayúsculas', () => {
    expect(filterSuppliers(options, 'COMPANIA')).toEqual([supplier])
  })
  it('mantiene todos los proveedores al limpiar la búsqueda', () => {
    expect(filterSuppliers(options, '')).toEqual(options)
  })
})
