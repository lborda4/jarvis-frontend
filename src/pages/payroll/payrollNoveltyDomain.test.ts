import { describe, expect, it } from 'vitest'
import type { PayrollDocument } from '../../services/payrollService'
import { blankEmployee, blankParameters, blankPayroll } from './payrollDefaults'
import { canEditPayrollNovelties, payrollNoveltyDateBounds, payrollNoveltyDateQuantity, payrollNoveltyLine, payrollNoveltyTotals, preparePayrollNovelties, stateForAddedPayrollEmployee } from './payrollNoveltyDomain'

const employee = { ...blankEmployee([], '2026-10-01'), id: 'employee', salary: '1800000', firstName: 'Ana', surname: 'Pérez' }
const parameters = { ...blankParameters('2026-10-01'), monthlyDays: '30', monthlyHours: '210' }
const salary = { id: 'salary', concept: 'salary', kind: 'accrued' as const, quantity: '15', amount: '900000.00', manual: false }
const state = { ...blankPayroll('2026-10'), employeeId: employee.id, payrollName: 'Octubre', payrollGroupId: 'group', periodicity: 'FIRST_HALF' as const,
  startDate: '2026-10-01', endDate: '2026-10-15', issueDate: '2026-10-15', workedDays: '15', lines: [salary] }
const custom = { code: 'internal_commission', kind: 'accrued' as const, name: 'Comisión especial', category: 'commissions', active: true, base: 'manual', factor: '', percentage: '', salaried: true }
describe('Novedades por empleado', () => {
  it('resta los días no hábiles del rango de vacaciones y conserva el dato para editar', () => {
    const quantity = payrollNoveltyDateQuantity('2026-10-01', '2026-10-15', '4')
    expect(quantity).toBe('11')
    expect(payrollNoveltyLine(state, custom, { id: 'vacation', quantity, amount: '100', percentage: '0', manual: true, startDate: '2026-10-01', endDate: '2026-10-15', nonWorkingDays: '4' })).toMatchObject({ quantity: '11', nonWorkingDays: '4' })
  })
  it.each(['-1', '1.5', '15', '16', '', 'abc'])('rechaza días no hábiles inválidos: %s', nonWorkingDays => {
    expect(() => payrollNoveltyDateQuantity('2026-10-01', '2026-10-15', nonWorkingDays)).toThrow('días no hábiles')
  })
  it.each([
    ['2026-11-01', '2026-11-15', '15'],
    ['2026-11-08', '2026-11-08', '1'],
    ['2028-02-01', '2028-02-29', '29'],
  ])('obtiene la cantidad del rango %s a %s incluyendo ambas fechas', (start, end, days) => {
    expect(payrollNoveltyDateQuantity(start, end)).toBe(days)
  })
  it.each([
    ['', '2026-11-15'], ['2026-11-15', '2026-11-01'], ['2026-02-30', '2026-03-01'],
  ])('rechaza rangos incompletos o inválidos: %s a %s', (start, end) => {
    expect(() => payrollNoveltyDateQuantity(start, end)).toThrow('Revisa la fecha')
  })
  it.each([
    ['2026-11', '2026-11-30'], ['2026-12', '2026-12-31'],
    ['2026-02', '2026-02-28'], ['2028-02', '2028-02-29'],
  ])('limita las fechas al mes y año %s', (period, max) => {
    expect(payrollNoveltyDateBounds(period)).toEqual({ min: `${period}-01`, max })
  })
  it.each(['2026-09-30', '2026-11-01', '2025-10-01'])('rechaza fechas de otros meses o años: %s', date => {
    expect(() => payrollNoveltyLine(state, custom, { id: 'dated', quantity: '1', amount: '100', percentage: '0', manual: true, startDate: date, endDate: date })).toThrow('dentro del mes de la nómina')
  })
  it('permite todo el mes de la nómina aunque se liquide una quincena', () => {
    expect(payrollNoveltyLine(state, custom, { id: 'dated', quantity: '1', amount: '100', percentage: '0', manual: true, startDate: '2026-10-16', endDate: '2026-10-31' }).endDate).toBe('2026-10-31')
  })
  it('guarda un concepto personalizado configurado con su naturaleza y mapeo', () => {
    const line = payrollNoveltyLine(state, custom, { id: 'new', quantity: '1', amount: '100000.25', percentage: '0', manual: true })
    expect(line).toMatchObject({ concept: custom.code, mapping: 'commissions', kind: 'accrued', amount: '100000.25' })
  })
  it('evita duplicar el salario al añadir novedades', () => {
    expect(() => payrollNoveltyLine(state, parameters.concepts.find(concept => concept.code === 'salary')!, { id: 'other', quantity: '15', amount: '900000', percentage: '0', manual: false })).toThrow('ya está incluido')
  })
  it('no duplica una línea al editarla', () => {
    expect(payrollNoveltyLine(state, parameters.concepts.find(concept => concept.code === 'salary')!, { id: 'salary', quantity: '15', amount: '910000', percentage: '0', manual: true }).id).toBe('salary')
  })
  it('rechaza una deducción que deja neto negativo', () => {
    expect(() => payrollNoveltyLine(state, { ...custom, kind: 'deduction' }, { id: 'deduction', quantity: '1', amount: '1000000', percentage: '0', manual: true })).toThrow('superan')
  })
  it('conserva todos los importes al liquidar, incluso los que antes eran automáticos', () => {
    const manual = { ...salary, id: 'manual', concept: 'commissions', amount: '12345.67', manual: true }
    const unknown = { ...manual, id: 'custom', concept: custom.code, manual: false }
    const result = preparePayrollNovelties({ ...state, lines: [{ ...salary, amount: '1', formula: 'salario / 2' }, manual, unknown] })
    expect(result.lines.map(line => line.amount)).toEqual(['1', '12345.67', '12345.67'])
    expect(result.lines.every(line => line.manual && line.formula === undefined)).toBe(true)
  })
  it('suma todas las filas con precisión de centavos', () => {
    const documents = [0, 1].map(index => ({ state: { ...state, lines: [{ ...salary, amount: '100.25' }, { id: `deduction-${index}`, concept: 'eps', kind: 'deduction' as const, amount: '10.10', quantity: '1' }] } }))
    expect(payrollNoveltyTotals(documents)).toEqual({ accrued: '200.50', deductions: '20.20', net: '180.30' })
  })
  it('al agregar un empleado respeta su ingreso a mitad del período y conserva el grupo', () => {
    const next = stateForAddedPayrollEmployee(state, { ...employee, admittanceDate: '2026-10-10' }, parameters)
    expect(next.payrollGroupId).toBe('group')
    expect(next.workedDays).toBe('6.00')
    expect(next.lines).toEqual([])
    expect(next.startDate).toBe(state.startDate)
  })
  it('inicia sin ingresos ni deducciones al agregar empleados y conserva los totales en cero', () => {
    const next = stateForAddedPayrollEmployee(state, employee, parameters)
    expect(next.lines).toEqual([])
    expect(payrollNoveltyTotals([{ state: next }])).toEqual({ accrued: '0.00', deductions: '0.00', net: '0.00' })
  })
  it('permite editar únicamente borradores o rechazadas', () => {
    for (const status of ['DRAFT', 'REJECTED']) expect(canEditPayrollNovelties({ status } as PayrollDocument)).toBe(true)
    for (const status of ['PROCESSING', 'ACCEPTED', 'UNKNOWN']) expect(canEditPayrollNovelties({ status } as PayrollDocument)).toBe(false)
  })
})
