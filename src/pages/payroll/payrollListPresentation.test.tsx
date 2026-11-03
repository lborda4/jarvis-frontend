import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { PayrollDocument } from '../../services/payrollService'
import { blankEmployee, blankPayroll } from './payrollDefaults'
import { filterPayrollList, payrollListTotals, payrollListStatusOptions } from './payrollListPresentation'
import { groupPayrollPeriods } from './payrollPeriods'
import PayrollPeriodAccordion from './PayrollPeriodAccordion'

function document(id: number, name = `Empleado ${id}`, status = 'DRAFT'): PayrollDocument {
  return { id: String(id), employeeId: String(id), originalId: null,
    employee: { ...blankEmployee([], '2026-10-01'), id: String(id), identification: String(1000 + id), firstName: name, surname: 'Pérez' },
    state: { ...blankPayroll('2026-10'), payrollGroupId: 'administration', payrollName: 'Administración', employeeId: String(id), startDate: '2026-10-01', endDate: '2026-10-15' },
    status, number: null, prefix: null, cune: null, accrued: '100000.25', deductions: '10000.10', net: '90000.15', updatedAt: '' }
}
describe('Listado de nóminas desplegable', () => {
  it('ofrece únicamente estados presentes, sin duplicarlos', () => {
    expect(payrollListStatusOptions([document(1), document(2)])).toEqual([{ value: 'DRAFT', label: 'Borrador' }])
    expect(payrollListStatusOptions([])).toEqual([])
  })
  it('actualiza las opciones con la búsqueda sin limitarse a la página actual', () => {
    const docs = [...Array.from({ length: 10 }, (_, index) => document(index, 'Ana')), document(11, 'Pedro', 'ACCEPTED')]
    expect(payrollListStatusOptions(docs).map(option => option.value)).toEqual(['DRAFT', 'ACCEPTED'])
    expect(payrollListStatusOptions(filterPayrollList(docs, 'Pedro', '')).map(option => option.value)).toEqual(['ACCEPTED'])
  })
  it('busca por empleado e identificación conservando el período correcto', () => {
    const docs = [document(1, 'Ana'), document(2, 'Pedro')]
    expect(filterPayrollList(docs, 'ana', '').map(item => item.id)).toEqual(['1'])
    expect(filterPayrollList(docs, '1002', '').map(item => item.id)).toEqual(['2'])
    expect(filterPayrollList(docs, 'administración', '')).toHaveLength(2)
    expect(filterPayrollList(docs, 'administracion', '')).toHaveLength(2)
    expect(filterPayrollList(docs, 'perez', '')).toHaveLength(2)
  })
  it('filtra estados de empleados en un período mixto y calcula los totales del resultado', () => {
    const docs = [document(1, 'Ana'), document(2, 'Pedro', 'ACCEPTED')]
    const visible = filterPayrollList(docs, '', 'DRAFT')
    expect(visible.map(item => item.id)).toEqual(['1'])
    expect(payrollListTotals(visible)).toEqual({ accrued: '100000.25', deductions: '10000.10', net: '90000.15', employees: 1 })
  })
  it('cuenta un empleado una sola vez si tiene dos períodos', () => {
    const first = document(1), second = { ...document(1), id: 'second' }
    second.state = { ...second.state, startDate: '2026-10-16', endDate: '2026-10-31' }
    expect(payrollListTotals([first, second])).toEqual({ accrued: '200000.50', deductions: '20000.20', net: '180000.30', employees: 1 })
  })
  const props = (docs: PayrollDocument[], expanded: boolean) => ({
    group: groupPayrollPeriods(docs)[0], documents: docs, expanded, busy: false, selected: [],
    onToggle: () => {}, onSelection: () => {}, onOpen: () => {}, onNovelties: () => {}, onExport: () => {}, actions: () => [], periodActions: [],
  })
  it('mantiene los empleados dentro del desplegable y muestra el estado accesible de la flecha', () => {
    const docs = [document(1, 'Ana')]
    const collapsed = renderToStaticMarkup(<PayrollPeriodAccordion {...props(docs, false)} />)
    const expanded = renderToStaticMarkup(<PayrollPeriodAccordion {...props(docs, true)} />)
    expect(collapsed).toContain('aria-expanded="false"')
    expect(collapsed).not.toContain('Ana Pérez')
    expect(expanded).toContain('aria-expanded="true"')
    expect(expanded).toContain('Ana Pérez')
    expect(expanded).toContain('Gestionar novedades')
  })
  it('mantiene accesibles más de diez empleados de un período sin truncar el desplegable', () => {
    const docs = Array.from({ length: 12 }, (_, index) => document(index))
    const html = renderToStaticMarkup(<PayrollPeriodAccordion {...props(docs, true)} />)
    for (const item of docs) expect(html).toContain(item.employee.firstName + ' Pérez')
    expect(html).not.toContain('Página siguiente')
  })
})
