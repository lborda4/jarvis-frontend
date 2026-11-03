import { describe, expect, it } from 'vitest'
import type { PayrollDocument } from '../../services/payrollService'
import { blankEmployee, blankParameters, blankPayroll } from './payrollDefaults'
import { canEditPayrollNovelties, payrollNoveltyLine, payrollNoveltyTotals, recalculatePayrollNovelties, stateForAddedPayrollEmployee } from './payrollNoveltyDomain'

const employee = { ...blankEmployee([], '2026-10-01'), id: 'employee', salary: '1800000', firstName: 'Ana', surname: 'Pérez' }
const parameters = { ...blankParameters('2026-10-01'), monthlyDays: '30', monthlyHours: '210' }
const salary = { id: 'salary', concept: 'salary', kind: 'accrued' as const, quantity: '15', amount: '900000.00', manual: false }
const state = { ...blankPayroll('2026-10'), employeeId: employee.id, payrollName: 'Octubre', payrollGroupId: 'group', periodicity: 'FIRST_HALF' as const,
  startDate: '2026-10-01', endDate: '2026-10-15', issueDate: '2026-10-15', workedDays: '15', lines: [salary] }
const custom = { code: 'internal_commission', kind: 'accrued' as const, name: 'Comisión especial', category: 'commissions', active: true, base: 'manual', factor: '', percentage: '', salaried: true }
describe('Novedades por empleado', () => {
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
  it('recalcula los automáticos y conserva los valores manuales y conceptos sin fórmula', () => {
    const manual = { ...salary, id: 'manual', concept: 'commissions', amount: '12345.67', manual: true }
    const unknown = { ...manual, id: 'custom', concept: custom.code, manual: false }
    const result = recalculatePayrollNovelties({ ...state, lines: [{ ...salary, amount: '1' }, manual, unknown] }, employee, parameters)
    expect(result.lines.map(line => line.amount)).toEqual(['900000.00', '12345.67', '12345.67'])
    expect(result.lines[1]).toEqual(manual)
  })
  it('suma todas las filas con precisión de centavos', () => {
    const documents = [0, 1].map(index => ({ state: { ...state, lines: [{ ...salary, amount: '100.25' }, { id: `deduction-${index}`, concept: 'eps', kind: 'deduction' as const, amount: '10.10', quantity: '1' }] } }))
    expect(payrollNoveltyTotals(documents)).toEqual({ accrued: '200.50', deductions: '20.20', net: '180.30' })
  })
  it('al agregar un empleado respeta su ingreso a mitad del período y conserva el grupo', () => {
    const next = stateForAddedPayrollEmployee(state, { ...employee, admittanceDate: '2026-10-10' }, parameters)
    expect(next.payrollGroupId).toBe('group')
    expect(next.workedDays).toBe('6.00')
    expect(next.lines[0].amount).toBe('360000.00')
    expect(next.startDate).toBe(state.startDate)
  })
  it('permite editar únicamente borradores o rechazadas', () => {
    for (const status of ['DRAFT', 'REJECTED']) expect(canEditPayrollNovelties({ status } as PayrollDocument)).toBe(true)
    for (const status of ['PROCESSING', 'ACCEPTED', 'UNKNOWN']) expect(canEditPayrollNovelties({ status } as PayrollDocument)).toBe(false)
  })
})
