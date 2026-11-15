import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { PayrollDocument } from '../../services/payrollService'
import { blankEmployee, blankPayroll } from './payrollDefaults'
import { groupPayrollMonths } from './payrollMonths'
import PayrollRegistersTable, { PayrollPeriodsTable } from './PayrollRegistersTable'
import PayrollDocumentTable from './PayrollDocumentTable'

function document(id: string, month: string, half = 1): PayrollDocument {
  return { id, employeeId: 'employee', originalId: null, employee: { ...blankEmployee([], `${month}-01`), firstName: 'Ana', surname: 'Pérez' },
    state: { ...blankPayroll(month), startDate: `${month}-${half === 1 ? '01' : '16'}`, endDate: `${month}-${half === 1 ? '15' : '30'}`, payrollName: half === 1 ? 'Primera nómina' : 'Segunda nómina', payrollGroupId: id },
    status: 'DRAFT', number: null, prefix: null, cune: null, accrued: '1000.25', deductions: '100.10', net: '900.15', updatedAt: '', canDelete: true }
}
const props = () => ({ months: groupPayrollMonths([document('second', '2026-11', 2), document('first', '2026-11'), document('old', '2026-10')]),
  busy: false, onReview: () => {}, onNovelties: () => {}, onExport: () => {}, onOpen: () => {}, documentActions: () => [], periodActions: () => [],
})
describe('Tablas compactas del registro de nóminas', () => {
  it('ofrece novedades por empleado sin menú y bloquea empleados enviados', () => {
    const draft = document('draft', '2026-11')
    const sent = { ...document('sent', '2026-11'), status: 'ACCEPTED' }
    const html = renderToStaticMarkup(<PayrollDocumentTable documents={[draft, sent]} selected={[]} selectable={false}
      busy={false} onSelection={() => {}} onOpen={() => {}} onNovelties={() => {}} onPayslip={() => {}}
      actions={() => [{ label: 'Editar', onClick: () => {} }]} />)
    expect(html.match(/>Gestionar novedades<\/button>/g)).toHaveLength(2)
    expect(html).toContain('disabled="">Gestionar novedades</button>')
    expect(html).not.toContain('aria-haspopup')
    expect(html).not.toContain('>Editar<')
    expect(html).toContain('<th>Desprendibles</th>')
    expect(html.match(/>Ver PDF<\/button>/g)).toHaveLength(2)
  })
  it('muestra meses como filas con encabezados compartidos e importes completos', () => {
    const html = renderToStaticMarkup(<PayrollRegistersTable {...props()} />)
    expect(html).toContain('Nóminas por mes')
    expect(html).toContain('<th>Mes</th>')
    expect(html).toContain('Noviembre 2026')
    expect(html).toContain('Octubre 2026')
    expect(html).toContain('Revisar mes')
    expect(html).toContain('aria-expanded="false"')
    expect(html).not.toContain('Primera nómina')
    expect(html).not.toContain('payroll-period__toggle')
  })
  it('despliega las nóminas dentro del mes manteniendo sus fechas y acceso a empleados', () => {
    const html = renderToStaticMarkup(<PayrollRegistersTable {...props()} initialMonthKey="2026-11" />)
    expect(html).toContain('aria-expanded="true"')
    expect(html).toContain('Nóminas del mes')
    expect(html).toContain('Primera nómina')
    expect(html).toContain('Segunda nómina')
    expect(html.indexOf('Primera nómina')).toBeLessThan(html.indexOf('Segunda nómina'))
    expect(html).toContain('01/11/2026')
    expect(html).toContain('30/11/2026')
    expect(html).toContain('Ver empleados')
    expect(html).not.toContain('Ana Pérez')
  })
  it('conserva los estados guardado y error y los menús del período', () => {
    const first = document('first', '2026-11')
    const second = { ...document('second', '2026-11', 2), status: 'REJECTED' }
    const html = renderToStaticMarkup(<PayrollPeriodsTable documents={[first, second]} busy={false} onDetails={() => {}} periodActions={() => [{ label: 'Editar', onClick: () => {} }]} />)
    expect(html).toContain('Guardada')
    expect(html).toContain('>Error</span>')
    expect(html).toContain('Acciones de Primera nómina')
    expect(html).toContain('Acciones de Segunda nómina')
    expect(html).not.toContain('Páginas de')
  })
  it('mantiene todos los períodos accesibles sin truncar grupos', () => {
    const documents = Array.from({ length: 12 }, (_, index) => ({ ...document(`group-${index}`, '2026-11'), state: { ...document(`group-${index}`, '2026-11').state, payrollName: `Grupo ${index}` } }))
    const html = renderToStaticMarkup(<PayrollPeriodsTable documents={documents} busy={false} onDetails={() => {}} periodActions={() => []} />)
    for (let index = 0; index < 12; index++) expect(html).toContain(`Grupo ${index}`)
  })
})
