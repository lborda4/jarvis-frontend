import { beforeEach, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ReactElement, ReactNode } from 'react'
import { companyQueryKey, invalidateQueryCache, peekCachedQuery, setActiveCompanyId, setCachedQuery } from '../../services/queryCache'
import { payrollService, type PayrollDetail, type PayrollDocument } from '../../services/payrollService'
import { blankEmployee, blankParameters, blankPayroll } from './payrollDefaults'
import PayrollPeriodNoveltiesModal from './PayrollPeriodNoveltiesModal'
import type { PayrollContext } from './PayrollPage'
import { hasUnsavedPayrollNovelties } from './usePayrollNoveltyDrafts'

type EditorProps = { detail: PayrollDetail; deferred: boolean; onSave: (state: PayrollDetail['state']) => Promise<void>; onClose: () => void; footer: ReactNode }
const editor = vi.hoisted(() => ({ props: null as EditorProps | null }))
vi.mock('./PayrollNoveltyModal', () => ({ default: (props: EditorProps) => { editor.props = props; return <>{props.footer}</> } }))
vi.mock('../../services/payrollService', () => ({ payrollService: { saveBatch: vi.fn(), save: vi.fn(), get: vi.fn() } }))
const parameters = blankParameters('2026-11-01')
const employee = { ...blankEmployee(), id: 'employee' }
const detail = { id: 'doc', state: { ...blankPayroll('2026-11'), employeeId: employee.id }, status: 'DRAFT', updated_at: '2026-11-16T13:00:00Z', employee_snapshot: employee, parameter_snapshot: parameters, files: [], transmissions: [], cune: null, number: null, prefix: null } satisfies PayrollDetail
const document = { id: detail.id, employeeId: employee.id, employee, state: detail.state, status: 'DRAFT', updatedAt: detail.updated_at } as PayrollDocument
const context = { busy: false, data: { parameters: [] } } as unknown as PayrollContext
const close = vi.fn(), reload = vi.fn(async () => {})
const key = () => companyQueryKey(['payroll-novelty-drafts'])
const render = () => renderToStaticMarkup(<PayrollPeriodNoveltiesModal documents={[document]} context={context} onReload={reload} onClose={close} />)
function commit() {
  const fragment = editor.props!.footer as ReactElement<{ children: ReactElement[] }>
  const toolbar = fragment.props.children[1] as ReactElement<{ children: ReactElement<{ onClick: () => Promise<void> }> }>
  return toolbar.props.children.props.onClick()
}
beforeEach(() => {
  invalidateQueryCache(); setActiveCompanyId('company-a'); vi.clearAllMocks()
  setCachedQuery(key(), { doc: structuredClone(detail) })
})
it('aplica varios cambios y eliminaciones locales sin PUT; guarda solo el estado final al confirmar', async () => {
  render()
  const withLine = { ...detail.state, lines: [{ id: 'one', kind: 'accrued' as const, concept: 'salary', amount: '100', quantity: '13' }] }
  await editor.props!.onSave(withLine)
  render()
  expect(editor.props!.detail.state.lines[0].amount).toBe('100')
  await editor.props!.onSave({ ...withLine, lines: [{ ...withLine.lines[0], amount: '200' }] })
  render()
  await editor.props!.onSave({ ...withLine, lines: [] })
  render()
  expect(editor.props!.deferred).toBe(true)
  expect(payrollService.save).not.toHaveBeenCalled()
  expect(payrollService.saveBatch).not.toHaveBeenCalled()
  expect(payrollService.get).not.toHaveBeenCalled()
  expect(hasUnsavedPayrollNovelties(['doc'])).toBe(true)
  expect(hasUnsavedPayrollNovelties(['other-document'])).toBe(false)
  await commit()
  expect(payrollService.saveBatch).toHaveBeenCalledExactlyOnceWith([{ id: 'doc', state: { ...withLine, lines: [] }, updatedAt: detail.updated_at }])
  expect(peekCachedQuery(key())).toEqual({})
  expect(hasUnsavedPayrollNovelties(['doc'])).toBe(false)
  expect(close).toHaveBeenCalledOnce()
})
it('conserva los cambios si falla el servidor y permite reintentar el mismo lote', async () => {
  vi.mocked(payrollService.saveBatch).mockRejectedValueOnce(new Error('Sin conexión')).mockResolvedValueOnce({ saved: ['doc'] })
  render()
  await commit()
  expect(close).not.toHaveBeenCalled()
  expect(peekCachedQuery<Record<string, PayrollDetail>>(key())?.doc.state).toEqual(detail.state)
  render()
  await commit()
  expect(payrollService.saveBatch).toHaveBeenCalledTimes(2)
  expect(close).toHaveBeenCalledOnce()
})
it('mantiene el borrador al cerrar el modal y lo descarta al cambiar de empresa', () => {
  render()
  editor.props!.onClose()
  expect(peekCachedQuery<Record<string, PayrollDetail>>(key())?.doc).toBeDefined()
  setActiveCompanyId('company-b')
  expect(peekCachedQuery(key())).toBeUndefined()
})
