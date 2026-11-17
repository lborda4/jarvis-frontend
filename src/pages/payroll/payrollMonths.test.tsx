import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { PayrollDocument } from '../../services/payrollService'
import { blankEmployee, blankPayroll } from './payrollDefaults'
import { groupPayrollMonths } from './payrollMonths'
import PayrollMonthlyReview from './PayrollMonthlyReview'
import PayrollMonthAccordion from './PayrollMonthAccordion'
import PayrollDocumentTable from './PayrollDocumentTable'

const document = (id: string, start: string, end: string, overrides: Partial<PayrollDocument> = {}): PayrollDocument => ({
  id, employeeId: 'ana', originalId: null, employee: { ...blankEmployee([], start), id: 'ana', firstName: 'Ana', surname: 'Pérez' },
  state: { ...blankPayroll(start.slice(0, 7)), employeeId: 'ana', startDate: start, endDate: end },
  status: 'DRAFT', number: null, prefix: null, cune: null, accrued: '100.10', deductions: '10.05', net: '90.05', updatedAt: '', ...overrides,
})
const first = () => document('first', '2026-11-01', '2026-11-15')
const second = () => document('second', '2026-11-16', '2026-11-30')

describe('Vista previa de nómina mensual', () => {
  it('agrupa quincenas por mes y acumula cada empleado una sola vez con precisión decimal', () => {
    const months = groupPayrollMonths([first(), second(), document('oct', '2026-10-01', '2026-10-31')])
    expect(months.map(month => month.key)).toEqual(['2026-11', '2026-10'])
    expect(months[0].employees).toHaveLength(1)
    expect(months[0]).toMatchObject({ accrued: '200.20', deductions: '20.10', net: '180.10', warnings: [] })
    expect(months[0].employees[0].documents).toHaveLength(2)
  })
  it('detecta superposiciones del mismo empleado aunque cambie el nombre del grupo', () => {
    const [month] = groupPayrollMonths([first(), { ...first(), id: 'copy', state: { ...first().state, payrollGroupId: 'otro' } }])
    expect(month.warnings.some(warning => warning.includes('superpuestos'))).toBe(true)
  })
  it('advierte por empleado cuando solo tiene una quincena sin impedir revisar el mes', () => {
    const [month] = groupPayrollMonths([first(), second(), document('other', '2026-11-16', '2026-11-30', { employeeId: 'otro' })])
    expect(month.warnings.some(warning => warning.includes('una sola quincena'))).toBe(true)
    expect(month.employees).toHaveLength(2)
  })
  it('no duplica los valores con notas de ajuste y avisa de envíos previos', () => {
    const [month] = groupPayrollMonths([{ ...first(), status: 'ACCEPTED' }, document('note', '2026-11-01', '2026-11-15', { originalId: 'first' })])
    expect(month.net).toBe('90.05')
    expect(month.documents).toHaveLength(2)
    expect(month.warnings.some(warning => warning.includes('notas de ajuste'))).toBe(true)
    expect(month.warnings.some(warning => warning.includes('envíos anteriores'))).toBe(true)
    expect(month.statusLabel).toBe('Con envíos previos')
  })
  it('muestra error si alguna nómina del mes falla', () => {
    expect(groupPayrollMonths([first(), { ...second(), status: 'REJECTED' }])[0].statusLabel).toBe('Con errores')
  })
  it('reconoce un envío mensual aceptado sin sumarlo otra vez ni tratarlo como envío antiguo', () => {
    const monthlySubmission = { id: 'monthly', status: 'ACCEPTED', cune: 'cune', prefix: 'SETP', number: '9' }
    const month = groupPayrollMonths([{ ...first(), status: 'ACCEPTED', monthlySubmission }, { ...second(), status: 'ACCEPTED', monthlySubmission }])[0]
    expect(month.statusLabel).toBe('Aceptada')
    expect(month.net).toBe('180.10')
    expect(month.warnings.some(warning => warning.includes('envíos anteriores'))).toBe(false)
    const html = renderToStaticMarkup(<PayrollMonthlyReview month={month} onBack={() => {}} />)
    expect(html).toContain('disabled=""')
    expect(html).not.toContain('Ver resultado mensual')
    expect(html).not.toContain('>Resultado</button>')
    expect(html).toContain('Ver detalle')
  })
  it('mantiene separados los empleados aceptados y los rechazados en un envío parcial', () => {
    const accepted = { ...first(), status: 'ACCEPTED', monthlySubmission: { id: 'ma', status: 'ACCEPTED', cune: 'cune', number: '1', prefix: 'SETP' } }
    const rejected = { ...second(), employeeId: 'other', status: 'REJECTED', monthlySubmission: { id: 'mb', status: 'REJECTED', cune: null, number: '2', prefix: 'SETP' }, submissionErrors: ['Revisa EPS'] }
    const month = groupPayrollMonths([accepted, rejected])[0]
    expect(month.statusLabel).toBe('Con errores')
    expect(month.employees.find(employee => employee.id === 'other')?.errors).toEqual(['Revisa EPS'])
    expect(month.employees.find(employee => employee.id === 'ana')?.submission?.id).toBe('ma')
  })
  it('muestra selección por empleado y exige elegir antes de habilitar el envío', () => {
    const month = groupPayrollMonths([first(), second()])[0]
    const html = renderToStaticMarkup(<PayrollMonthlyReview month={month} onBack={() => {}} />)
    expect(html).toContain('Ana Pérez')
    expect(html).toContain('Ver detalle')
    expect(html).toContain('<th>Empleado</th>')
    expect(html).not.toContain('payroll-month-review__breakdown')
    expect(html).not.toContain('Páginas de empleados del mes')
    expect(html).toContain('disabled="">Enviar seleccionados a la DIAN (0)')
    expect(html).toContain('Seleccionar todos los empleados pendientes del mes')
    expect(html).toContain('aria-label="Enviar nómina de Ana Pérez"')
    expect(html).not.toContain('Vista previa')
  })
  it('presenta el mes con acceso al resumen y conserva todos los períodos', () => {
    const month = groupPayrollMonths([first(), second()])[0]
    const html = renderToStaticMarkup(<PayrollMonthAccordion month={month} onReview={() => {}}><p>Primera quincena</p><p>Segunda quincena</p></PayrollMonthAccordion>)
    expect(html).toContain('Noviembre 2026')
    expect(html).toContain('Revisar nómina del mes')
    expect(html).toContain('Primera quincena')
    expect(html).toContain('Segunda quincena')
  })
  it('oculta los selectores de envío individual en la vista por quincenas', () => {
    const html = renderToStaticMarkup(<PayrollDocumentTable documents={[first()]} selected={[]} selectable={false} busy={false} onSelection={() => {}} onOpen={() => {}} actions={() => []} />)
    expect(html).not.toContain('type="checkbox"')
    expect(html).toContain('Ana Pérez')
  })
})
