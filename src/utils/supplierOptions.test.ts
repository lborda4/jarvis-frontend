import { expect, it } from 'vitest'
import { uniqueSupplierOptions } from './supplierOptions'

it('muestra una sola opción por NIT aunque haya varias entradas y variaciones del nombre', () => {
  expect(uniqueSupplierOptions([
    { nit: '66709203', name: 'Proveedor de prueba' },
    { nit: '66709203', name: 'Proveedor de prueba' },
    { nit: ' 66709203 ', name: 'PROVEEDOR DE PRUEBA' },
  ])).toEqual([{ nit: '66709203', name: 'Proveedor de prueba' }])
})

it('conserva proveedores de igual nombre con distinto documento', () => {
  expect(uniqueSupplierOptions([{ nit: '123', name: 'Empresa' }, { nit: '456', name: 'Empresa' }])).toHaveLength(2)
})

it('prefiere un nombre disponible y omite documentos vacíos', () => {
  expect(uniqueSupplierOptions([{ nit: '123', name: '' }, { nit: '123', name: 'Empresa' }, { nit: ' ', name: 'Sin documento' }]))
    .toEqual([{ nit: '123', name: 'Empresa' }])
})
