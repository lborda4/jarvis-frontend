import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Concept, PayrollDocument } from '../../services/payrollService'
import { blankEmployee, blankPayroll } from './payrollDefaults'
import { groupPayrollMonths } from './payrollMonths'
import PayrollMonthlyEmployeeModal, { payrollEmployeeConcepts, payrollEmployeeDocuments } from './PayrollMonthlyEmployeeModal'
import PayrollMonthlyReview from './PayrollMonthlyReview'

const employee = { ...blankEmployee([], '2026-11-01'), id: 'ana', firstName: 'Ana', surname: 'Pérez' }
const source = (half: number): PayrollDocument => ({ id: `source-${half}`, employeeId: 'ana', originalId: null, employee,
  state: { ...blankPayroll('2026-11'), startDate: `2026-11-${half === 1 ? '01' : '16'}`, endDate: `2026-11-${half === 1 ? '15' : '30'}`, lines: [
    { id: 'salary', concept: 'salary', kind: 'accrued', amount: half === 1 ? '1000.10' : '2000.20', quantity: '15' },
    { id: 'eps', concept: 'eps', kind: 'deduction', amount: '40.25', quantity: '1' },
  ] }, status: 'DRAFT', number: null, prefix: null, cune: null, accrued: half === 1 ? '1000.10' : '2000.20', deductions: '40.25', net: half === 1 ? '959.85' : '1959.95', updatedAt: '',
})
describe('Detalle mensual de empleado en modal', () => {
  it('separa las quincenas y conserva el mes completo sin duplicar conceptos', () => {
    const documents = [source(1), source(2)]
    expect(payrollEmployeeDocuments(documents, 'month')).toHaveLength(2)
    expect(payrollEmployeeDocuments(documents, 'first').map(document => document.id)).toEqual(['source-1'])
    expect(payrollEmployeeDocuments(documents, 'second').map(document => document.id)).toEqual(['source-2'])
    expect(payrollEmployeeConcepts(documents).map(row => row.amount)).toEqual(['3000.30', '80.50'])
    expect(payrollEmployeeConcepts(payrollEmployeeDocuments(documents, 'first')).map(row => row.amount)).toEqual(['1000.10', '40.25'])
  })
  it('no inventa quincenas al partir un período mensual', () => {
    const monthly = source(1)
    monthly.state.endDate = '2026-11-30'
    expect(payrollEmployeeDocuments([monthly], 'month')).toEqual([monthly])
    expect(payrollEmployeeDocuments([monthly], 'first')).toEqual([])
    expect(payrollEmployeeDocuments([monthly], 'second')).toEqual([])
  })
  it('presenta un modal con tres vistas, conceptos, fechas y cierre mediante X', () => {
    const month = groupPayrollMonths([source(1), source(2)])[0]
    const html = renderToStaticMarkup(<PayrollMonthlyEmployeeModal employee={month.employees[0]} monthLabel={month.label} status="DRAFT" busy={false} onClose={() => {}} onEditEmployee={() => {}} />)
    expect(html).toContain('role="dialog"')
    expect(html).toContain('aria-modal="true"')
    expect(html).toContain('aria-label="Cerrar"')
    expect(html).toContain('Mes completo')
    expect(html).toContain('>Editar empleado</button>')
    expect(html).toContain('Primera quincena')
    expect(html).toContain('Segunda quincena')
    expect(html).toContain('aria-pressed="true"')
    expect(html).toContain('Salario básico')
    expect(html).toContain('01/11/2026')
    expect(html).toContain('30/11/2026')
  })
  it('respeta los nombres configurados y mantiene descripciones de deducciones distintas', () => {
    const document = source(1)
    document.state.lines = [
      { id: 'one', concept: 'other_deduction', kind: 'deduction', quantity: '1', amount: '5.20', description: 'Cuota uno' },
      { id: 'two', concept: 'other_deduction', kind: 'deduction', quantity: '1', amount: '8.30', description: 'Cuota dos' },
    ]
    const rows = payrollEmployeeConcepts([document], [{ code: 'other_deduction', name: 'Descuento acordado' } as Concept])
    expect(rows.map(row => row.label)).toEqual(['Descuento acordado', 'Descuento acordado'])
    expect(rows.map(row => row.description)).toEqual(['Cuota uno', 'Cuota dos'])
  })
  it('pagina por el total de empleados y conserva el acceso a los demás registros', () => {
    const documents = Array.from({ length: 11 }, (_, index) => ({ ...source(1), id: `source-${index}`, employeeId: `employee-${index}`, employee: { ...employee, firstName: `Empleado ${index}` } }))
    const month = groupPayrollMonths(documents)[0]
    const html = renderToStaticMarkup(<PayrollMonthlyReview month={month} onBack={() => {}} />)
    expect(html).toContain('Páginas de empleados del mes')
    expect(html).toContain('Siguiente')
    expect(html).toContain('Empleado 9')
    expect(html).not.toContain('Empleado 10')
  })
  it('oculta el detalle técnico y permite verificar un envío por confirmar', () => {
    const document = { ...source(1), status: 'UNCERTAIN', submissionErrors: ['Regla: 90 secreto de prueba'], monthlySubmission: { id: 'monthly', status: 'UNCERTAIN', number: '1', prefix: 'NI', cune: 'a'.repeat(96) } }
    const month = groupPayrollMonths([document])[0]
    const html = renderToStaticMarkup(<PayrollMonthlyReview month={month} onBack={() => {}} />)
    expect(html).toContain('Verificar envío')
    expect(html).not.toContain('Regla: 90 secreto de prueba')
    expect(html).not.toContain('avisos')
  })
  it('oculta la precaución cuando todos los empleados del mes están aceptados', () => {
    const document = source(1)
    document.monthlySubmission = { id: 'monthly', status: 'ACCEPTED', number: '6', prefix: 'NI', cune: 'accepted' }
    const month = groupPayrollMonths([document])[0]
    expect(month.warnings.some(warning => warning.includes('una sola quincena'))).toBe(true)
    const html = renderToStaticMarkup(<PayrollMonthlyReview month={month} onBack={() => {}} />)
    expect(html).toContain('Aceptada')
    expect(html).not.toContain('Hay empleados con una sola quincena')
  })
  it.each(['DRAFT', 'REJECTED', 'PROCESSING', 'UNCERTAIN'])('mantiene la precaución si queda un empleado %s aunque otro esté aceptado', status => {
    const accepted = source(1)
    accepted.monthlySubmission = { id: 'monthly', status: 'ACCEPTED', number: '6', prefix: 'NI', cune: 'accepted' }
    const other = { ...source(1), id: 'other-period', employeeId: 'other', employee: { ...employee, id: 'other' }, status }
    const month = groupPayrollMonths([accepted, other])[0]
    const html = renderToStaticMarkup(<PayrollMonthlyReview month={month} onBack={() => {}} />)
    expect(html).toContain('Hay empleados con una sola quincena')
  })
})
