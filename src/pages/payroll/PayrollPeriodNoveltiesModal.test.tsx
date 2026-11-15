import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ReactNode } from 'react'
import type { PayrollDocument } from '../../services/payrollService'
import { blankEmployee, blankParameters, blankPayroll } from './payrollDefaults'
import PayrollPeriodNoveltiesModal from './PayrollPeriodNoveltiesModal'
import type { PayrollContext } from './PayrollPage'

vi.mock('./PayrollPage', () => ({
  Field: ({ label, children }: { label: string; children: ReactNode }) => <label>{label}{children}</label>,
  Modal: ({ children }: { children: ReactNode }) => <div role="dialog">{children}</div>,
}))
const parameters = blankParameters('2026-11-01')
const context: PayrollContext = { data: { employees: [], positions: [], parameters: [{ id: 'parameters', validFrom: '2026-11-01', data: parameters }], settings: { enabled: true, environment: 2, prefix: 'SETP' }, nextNumber: '1' }, busy: false, reload: async () => {}, run: async action => { await action(); return true } }
function document(id: string, name: string, status = 'DRAFT'): PayrollDocument {
  return { id, employeeId: id, employee: { ...blankEmployee(), firstName: name, surname: 'Pérez', identification: id }, originalId: null, state: blankPayroll('2026-11'), status, number: null, prefix: null, cune: null, accrued: '1000', deductions: '0', net: '1000', updatedAt: '' }
}
describe('Acceso directo al modal de novedades', () => {
  it('abre un único modal para el empleado sin selector ni panel de novedades', () => {
    const html = renderToStaticMarkup(<PayrollPeriodNoveltiesModal documents={[document('ana', 'Ana'), document('laura', 'Laura')]} context={context} onClose={() => {}} onReload={async () => {}} />)
    expect(html.match(/role="dialog"/g)).toHaveLength(1)
    expect(html).toContain('Registrar novedades de nómina')
    expect(html).not.toContain('<select')
    expect(html).toContain('Ana Pérez')
    expect(html).not.toContain('Laura Pérez')
    expect(html).toContain('Cargando novedades del empleado')
    expect(html).not.toContain('Novedades por empleado')
    expect(html).not.toContain('Guardar período')
  })
  it('elige un empleado editable sin mostrar un selector', () => {
    const html = renderToStaticMarkup(<PayrollPeriodNoveltiesModal documents={[document('sent', 'Aceptada', 'ACCEPTED'), document('draft', 'Editable')]} context={context} onClose={() => {}} onReload={async () => {}} />)
    expect(html).not.toContain('<select')
    expect(html).toContain('Editable Pérez')
    expect(html).not.toContain('Aceptada Pérez')
  })
  it('explica el bloqueo si todo el período ya fue enviado', () => {
    const html = renderToStaticMarkup(<PayrollPeriodNoveltiesModal documents={[document('sent', 'Ana', 'UNCERTAIN')]} context={context} onClose={() => {}} onReload={async () => {}} />)
    expect(html).toContain('No se pueden modificar las novedades')
    expect(html).not.toContain('Cargando novedades')
    expect(html).toContain('aria-label="Cerrar"')
  })
})
