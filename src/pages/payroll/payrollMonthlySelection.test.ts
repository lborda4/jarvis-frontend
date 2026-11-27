import { describe, expect, it } from 'vitest'
import { groupPayrollMonths } from './payrollMonths'
import { payrollMonthlySendQueue } from './payrollMonthlySelection'
import { blankEmployee, blankPayroll } from './payrollDefaults'
import type { PayrollDocument } from '../../services/payrollService'

const documents = Array.from({ length: 12 }, (_, index): PayrollDocument => ({
  id: `doc-${index}`, employeeId: `employee-${index}`, originalId: null,
  employee: { ...blankEmployee(), firstName: `Empleado ${index}` },
  state: blankPayroll('2026-11'), status: 'DRAFT', number: null, prefix: null, cune: null,
  accrued: '1000', deductions: '0', net: '1000', updatedAt: '',
}))

describe('Selección de empleados para envío mensual', () => {
  it('no envía empleados cuando la selección está vacía', () => {
    const [month] = groupPayrollMonths(documents)
    expect(payrollMonthlySendQueue(month.employees, [])).toEqual([])
  })
  it('envía solo los marcados incluyendo los que están en otra página', () => {
    const [month] = groupPayrollMonths(documents)
    expect(payrollMonthlySendQueue(month.employees, ['employee-0', 'employee-11']).map(employee => employee.id).sort()).toEqual(['employee-0', 'employee-11'])
    const all = payrollMonthlySendQueue(month.employees)
    expect(payrollMonthlySendQueue(month.employees, all.map(employee => employee.id))).toHaveLength(12)
  })
  it('excluye aceptados, pendientes de confirmación y envíos históricos aunque se marquen', () => {
    const [month] = groupPayrollMonths(documents.map((document, index) => index === 0 ? { ...document, status: 'ACCEPTED', number: '1' } : index === 1 ? { ...document,
      monthlySubmission: { id: 'monthly', status: 'UNCERTAIN', cune: null, prefix: null, number: '2' } } : document))
    const result = payrollMonthlySendQueue(month.employees, documents.map(document => document.employeeId), { 'employee-2': { status: 'PROCESSING' } })
    expect(result).toHaveLength(9)
    expect(result.some(employee => ['employee-0', 'employee-1', 'employee-2'].includes(employee.id))).toBe(false)
  })
  it('permite mantener seleccionados los rechazos confirmados para reintentar', () => {
    const rejected = { ...documents[0], status: 'REJECTED', monthlySubmission: { id: 'monthly', status: 'REJECTED', cune: null, prefix: 'NI', number: '1' } }
    const [month] = groupPayrollMonths([rejected])
    expect(payrollMonthlySendQueue(month.employees, [rejected.employeeId], { [rejected.employeeId]: { status: 'REJECTED' } })).toHaveLength(1)
  })
})
