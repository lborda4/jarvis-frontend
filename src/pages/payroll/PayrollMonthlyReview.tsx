import { useEffect, useId, useRef, useState } from 'react'
import axios from 'axios'
import type { PayrollMonth } from './payrollMonths'
import { currency, employeeName, statusLabels } from './payrollDefaults'
import { payrollService, type Concept } from '../../services/payrollService'
import { getApiErrorMessage } from '../../services/apiClient'
import { payrollSubmissionErrors } from '../../utils/payrollSubmissionErrors'
import Modal from '../../components/Modal'
import PayrollMonthlyEmployeeModal from './PayrollMonthlyEmployeeModal'
import { shouldShowTablePagination } from '../../utils/tablePagination'
import { payrollMonthlySendQueue } from './payrollMonthlySelection'
import { payrollRequiredDeductionErrors } from '../../utils/payrollRequiredDeductions'
import DocumentSendOverlay from '../../components/DocumentSendOverlay'
import DocumentNotice from '../../components/DocumentNotice'
import { payrollMonthlySendNotice } from './payrollMonthlySendNotice'
import { hasUnsavedPayrollNovelties } from './usePayrollNoveltyDrafts'
import { payrollAdjustmentLabel } from './payrollAdjustmentTargets'

export default function PayrollMonthlyReview({ month, onBack, onReload, onBusyChange, concepts, onEditEmployee }: { month: PayrollMonth; onBack: () => void; onReload?: () => Promise<void>; onBusyChange?: (busy: boolean) => void; concepts?: Concept[]; onEditEmployee?: (id: string) => void }) {
  const modalId = useId()
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [notice, setNotice] = useState<ReturnType<typeof payrollMonthlySendNotice> | null>(null)
  const [error, setError] = useState('')
  const [employeeId, setEmployeeId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const selectAllRef = useRef<HTMLInputElement>(null)
  const pageSize = 10
  const pages = Math.max(1, Math.ceil(month.employees.length / pageSize))
  const currentPage = Math.min(page, pages)
  const visibleEmployees = month.employees.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const employeeDetail = month.employees.find(employee => employee.id === employeeId)
  const [attempts, setAttempts] = useState<Record<string, { status: string; errors: string[] }>>({})
  const allAccepted = month.employees.length > 0 && month.employees.every(employee =>
    (employee.submission?.status ?? attempts[employee.id]?.status ?? employee.status) === 'ACCEPTED')
  const pending = payrollMonthlySendQueue(month.employees, undefined, attempts)
  const selectedEmployees = payrollMonthlySendQueue(month.employees, selectedIds, attempts)
  const pendingIds = new Set(pending.map(employee => employee.id))
  const selected = new Set(selectedEmployees.map(employee => employee.id))
  const allSelected = pending.length > 0 && selectedEmployees.length === pending.length
  const partlySelected = selectedEmployees.length > 0 && !allSelected
  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = partlySelected
  }, [partlySelected])
  const send = async () => {
    if (busy || !selectedEmployees.length) return
    if (hasUnsavedPayrollNovelties(selectedEmployees.flatMap(employee => employee.documents.map(document => document.id)))) {
      setConfirm(false)
      setError('Hay novedades sin guardar. Vuelve al período y pulsa Guardar período antes de enviar a la DIAN.')
      return
    }
    const queue = [...selectedEmployees]
    const statuses: string[] = []
    setNotice(null); setConfirm(false); setBusy(true); onBusyChange?.(true); setError('')
    try {
      for (const employee of queue) {
        setProgress(`${statuses.length + 1} de ${queue.length} · ${employeeName(employee.employee)}`)
        try {
          const missing = payrollRequiredDeductionErrors({ lines: employee.documents.flatMap(document => document.state.lines.map(line => ({ ...line,
            typeLawDeductionsId: line.typeLawDeductionsId ?? ((line.mapping ?? line.concept) === 'eps' ? document.state.epsTypeLawDeductionsId : (line.mapping ?? line.concept) === 'pension' ? document.state.pensionTypeLawDeductionsId : undefined),
          }))) })
          if (missing.length) throw new Error(missing.join(' '))
          const result = await payrollService.sendMonthlyEmployee(month.key, employee.id, employee.documents)
          const last = result.transmissions[0]
          const errors = result.status === 'ACCEPTED' ? [] : payrollSubmissionErrors([last?.error, last?.validation, last?.response])
          statuses.push(result.status)
          setAttempts(previous => ({ ...previous, [employee.id]: { status: result.status, errors } }))
        } catch (error) {
          statuses.push('REJECTED')
          const messages = payrollSubmissionErrors(axios.isAxiosError(error) ? error.response?.data : null)
          setAttempts(previous => ({ ...previous, [employee.id]: { status: 'REJECTED', errors: messages.length ? messages : [getApiErrorMessage(error, 'No se pudo confirmar el envío. Revisa el resultado antes de reintentar.')] } }))
        }
        await onReload?.()
      }
    } catch (error) { setError(getApiErrorMessage(error, 'No se pudo actualizar el resumen. Actualízalo antes de volver a enviar.')) }
    finally { setBusy(false); setSelectedIds([]); setProgress(''); onBusyChange?.(false); setNotice(payrollMonthlySendNotice(statuses, queue.length)) }
  }
  return <section className="payroll__card payroll-month-review">
    <div className="payroll-period__toolbar">
      <div><h2>Resumen mensual · {month.label}</h2><p>Acumulado del mes completo. Los filtros del listado no afectan este resumen.</p></div>
      <button className="payroll__button" disabled={busy} onClick={onBack}>Volver a nóminas</button>
    </div>
    <div className="payroll-month-review__content">
      {!allAccepted && month.warnings.length > 0 && <div className="payroll__notice">
        <ul>
          {month.warnings.map(warning => <li key={warning}>{warning}</li>)}
        </ul>
      </div>}
      {error && <div className="payroll__notice payroll__notice--error" role="alert">{error}</div>}
      <div className="payroll-period__totals">
        <span>Ingresos <strong>{currency(month.accrued)}</strong></span>
        <span>Deducciones <strong>{currency(month.deductions)}</strong></span>
        <span>Neto del mes <strong>{currency(month.net)}</strong></span>
      </div>
      <h3>{month.employees.length} {month.employees.length === 1 ? 'empleado' : 'empleados'} · Un documento mensual por empleado</h3>
      <p className="payroll__muted" role="status">{selectedEmployees.length} de {pending.length} empleados pendientes seleccionados para envío. La casilla superior selecciona todos los pendientes del mes.</p>
      <div className="payroll-month-employees payroll-month-employees--selection" tabIndex={0} role="region" aria-label="Resumen de empleados del mes">
        <table><thead><tr><th><input ref={selectAllRef} type="checkbox" aria-label="Seleccionar todos los empleados pendientes del mes" checked={allSelected} disabled={busy || !pending.length}
          onChange={event => setSelectedIds(event.target.checked ? pending.map(employee => employee.id) : [])} /></th><th>Empleado</th><th>Ingresos</th><th>Deducciones</th><th>Neto del mes</th><th>Estado</th><th>Detalle</th></tr></thead>
          <tbody>{visibleEmployees.map(employee => {
            const status = employee.submission?.status ?? attempts[employee.id]?.status ?? employee.status
            const errors = attempts[employee.id]?.errors ?? employee.errors
            return <tr key={employee.id}>
              <td><input type="checkbox" aria-label={`Enviar nómina de ${employeeName(employee.employee)}`} checked={selected.has(employee.id)} disabled={busy || !pendingIds.has(employee.id)}
                onChange={event => setSelectedIds(previous => event.target.checked ? [...new Set([...previous, employee.id])] : previous.filter(id => id !== employee.id))} /></td>
              <td><button type="button" className="payroll__link payroll-month-employees__name" onClick={() => setEmployeeId(employee.id)}>{employeeName(employee.employee)}</button><small>{employee.employee.identification} · {employee.documents.length} {employee.documents.length === 1 ? 'período' : 'períodos'}</small></td>
              <td>{currency(employee.accrued)}</td><td>{currency(employee.deductions)}</td><td><strong>{currency(employee.net)}</strong></td>
              <td><span className={`payroll__badge payroll__badge--${status}`}>{statusLabels[status] ?? status}</span>
                {employee.documents.find(document => document.adjustment)?.adjustment && <small>{payrollAdjustmentLabel(employee.documents.find(document => document.adjustment)?.adjustment)}</small>}
              </td>
              <td><button type="button" className="payroll__link" onClick={() => setEmployeeId(employee.id)}>Ver detalle{errors.length > 0 ? ` · ${errors.length} avisos` : ''}</button></td>
            </tr>
          })}</tbody>
        </table>
      </div>
      {shouldShowTablePagination(month.employees.length, pageSize) && <nav className="payroll__pagination" aria-label="Páginas de empleados del mes">
        <button className="payroll__button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Anterior</button><span>{currentPage} / {pages}</span><button className="payroll__button" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>Siguiente</button>
      </nav>}
      <div className="payroll__toolbar"><button className="payroll__button payroll__button--primary" disabled={busy || !selectedEmployees.length} onClick={() => setConfirm(true)}>Enviar seleccionados a la DIAN ({selectedEmployees.length})</button></div>
    </div>
    <DocumentSendOverlay open={busy} documentTitle="nómina mensual" detail={progress ? `Transmitiendo a la DIAN · ${progress}` : 'Preparando el envío mensual a la DIAN'} />
    {notice && <DocumentNotice {...notice} onDismiss={() => setNotice(null)} />}
    {employeeDetail && <PayrollMonthlyEmployeeModal key={employeeDetail.id} employee={employeeDetail} monthLabel={month.label} concepts={concepts}
      status={employeeDetail.submission?.status ?? attempts[employeeDetail.id]?.status ?? employeeDetail.status}
      errors={attempts[employeeDetail.id]?.errors ?? employeeDetail.errors} busy={busy} onClose={() => setEmployeeId(null)}
      onEditEmployee={onEditEmployee ? () => { if (!busy) { setEmployeeId(null); onEditEmployee(employeeDetail.id) } } : undefined} />}
    {confirm && <Modal isOpen busy={busy} labelledBy={`${modalId}-confirm`} className="payroll-month-modal" onClose={() => setConfirm(false)}>
      <h2 id={`${modalId}-confirm`}>Confirmar envío mensual</h2>
      <p>Se enviará un documento mensual por cada uno de los {selectedEmployees.length} empleados seleccionados, acumulando sus ingresos, deducciones y fechas de pago de {month.label.toLocaleLowerCase('es')}.</p>
      <ul>{selectedEmployees.map(employee => <li key={employee.id}>{employeeName(employee.employee)} · {employee.employee.identification}</li>)}</ul>
      <button className="payroll__button payroll__button--primary" disabled={busy || !selectedEmployees.length} onClick={() => void send()}>Confirmar envío a la DIAN</button>
    </Modal>}
  </section>
}
