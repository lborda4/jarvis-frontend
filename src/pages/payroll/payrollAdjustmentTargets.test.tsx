import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { blankEmployee, blankPayroll } from './payrollDefaults'
import type { PayrollDocument } from '../../services/payrollService'
import { groupPayrollMonths } from './payrollMonths'
import { payrollAdjustmentLabel, payrollAdjustmentTargets } from './payrollAdjustmentTargets'
import PayrollRegistersTable, { PayrollPeriodsTable } from './PayrollRegistersTable'

const source = (id: string, overrides: Partial<PayrollDocument> = {}): PayrollDocument => ({ id, employeeId: 'ana', employee: blankEmployee(), state: blankPayroll('2026-10'),
  originalId: null, status: 'ACCEPTED', number: null, prefix: null, cune: null, accrued: '100', deductions: '10', net: '90', updatedAt: '',
  monthlySubmission: { id: 'monthly', status: 'ACCEPTED', number: '6', prefix: 'NI', cune: 'cune' }, ...overrides })
const month = (documents: PayrollDocument[]) => groupPayrollMonths(documents)[0]
const table = (documents: PayrollDocument[]) => renderToStaticMarkup(<PayrollRegistersTable months={[month(documents)]} busy={false} onReview={() => {}} onAdjustment={() => {}}
  onNovelties={() => {}} onExport={() => {}} onOpen={() => {}} documentActions={() => []} periodActions={() => []} />)

describe('acciones de ajuste del documento mensual', () => {
  it('resuelve el documento enviado y no crea dos ajustes por tener dos quincenas', () => {
    const targets = payrollAdjustmentTargets(month([source('first'), source('second')]));
    expect(targets).toHaveLength(1)
    expect(targets[0]).toMatchObject({ id: 'monthly', originalId: 'monthly' })
  })
  it('no ofrece borradores, rechazos ni las notas como si fueran nóminas nuevas', () => {
    expect(payrollAdjustmentTargets(month([source('draft', { status: 'DRAFT', monthlySubmission: undefined }), source('note', { originalId: 'monthly' })]))).toEqual([])
    expect(table([source('draft', { status: 'DRAFT', monthlySubmission: undefined })])).not.toContain('>Reemplazar<')
  })
  it('muestra el menú de tres puntos sin enlaces sueltos para el mes aceptado', () => {
    const html = table([source('accepted')])
    expect(html).toContain('aria-label="Acciones de Octubre 2026"')
    expect(html).toContain('aria-haspopup="menu"')
    expect(html).not.toContain('>Revisar mes</button>')
    expect(html).not.toContain('>Eliminar</button>')
    expect(html).not.toContain('>Reemplazar</button>')
  })
  it('usa el reemplazo aceptado más reciente y muestra el ajuste pendiente', () => {
    const adjustment = { id: 'replacement', status: 'ACCEPTED', noteType: 1, number: '7', prefix: 'NA' }
    const targets = payrollAdjustmentTargets(month([source('first', { adjustmentTargetId: 'replacement', adjustment })]))
    expect(targets[0].originalId).toBe('replacement')
    expect(table([source('first', { adjustmentTargetId: 'replacement', adjustment })])).toContain('Reemplazo aceptado')
    expect(payrollAdjustmentLabel({ ...adjustment, status: 'UNCERTAIN' })).toBe('Reemplazo por confirmar')
  })
  it('muestra anulación aceptada y oculta las acciones cuando el envío ya se anuló', () => {
    const document = source('first', { adjustmentTargetId: null, adjustment: { id: 'cancel', status: 'ACCEPTED', noteType: 2, number: '1', prefix: 'NA' } })
    const html = table([document])
    expect(html).toContain('Anulación aceptada')
    expect(html).not.toContain('>Eliminar</button>')
    expect(html).not.toContain('>Reemplazar</button>')
    expect(payrollAdjustmentTargets(month([document]))[0].originalId).toBeNull()
  })
  it('no suma otra vez las notas en la tabla de períodos', () => {
    const document = source('source')
    const note = source('note', { originalId: 'monthly', state: { ...document.state, payrollName: 'Nota de ajuste' }, accrued: '5000' })
    const html = renderToStaticMarkup(<PayrollPeriodsTable documents={[document, note]} busy={false} onDetails={() => {}} periodActions={() => []} />)
    expect(html).not.toContain('Nota de ajuste')
    expect(html).not.toContain('5.100')
    expect(html).toContain('100,00')
  })
})
