import { expect, it } from 'vitest'
import { filterReportOptions } from './reportFilterOptions'

const options = [{ value: '900123', label: 'Compañía García — 900123' }, { value: '800234', label: 'Juan Pérez — 800234' }]

it('muestra todas las opciones al abrir sin texto y busca por nombre o identificación', () => {
  expect(filterReportOptions(options, '')).toEqual(options)
  expect(filterReportOptions(options, 'GARCIA')).toEqual([options[0]])
  expect(filterReportOptions(options, 'compania 900')).toEqual([options[0]])
  expect(filterReportOptions(options, '234')).toEqual([options[1]])
  expect(filterReportOptions(options, 'inexistente')).toEqual([])
})
