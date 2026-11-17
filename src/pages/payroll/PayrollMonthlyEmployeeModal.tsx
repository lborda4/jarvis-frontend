import { useId, useState } from 'react'
import Modal from '../../components/Modal'
import type { Concept, PayrollDocument } from '../../services/payrollService'
import { cents, money } from '../../utils/payrollDomain'
import { currency, defaultConcepts, employeeName, statusLabels } from './payrollDefaults'
import { payrollMonthTotals, type PayrollMonth } from './payrollMonths'
import PayrollSubmissionFeedback from './PayrollSubmissionFeedback'

export type PayrollEmployeeView = 'month' | 'first' | 'second'
export function payrollEmployeeDocuments(documents: PayrollDocument[], view: PayrollEmployeeView) {
  if (view === 'month') return documents
  return documents.filter(document => document.state.startDate.slice(0, 7) === document.state.endDate.slice(0, 7) && (view === 'first'
    ? Number(document.state.endDate.slice(-2)) <= 15
    : Number(document.state.startDate.slice(-2)) >= 16))
}

export function payrollEmployeeConcepts(documents: PayrollDocument[], concepts: Concept[] = defaultConcepts) {
  const rows = new Map<string, { key: string; label: string; description?: string; kind: 'accrued' | 'deduction'; amount: bigint }>()
  for (const document of documents) for (const line of document.state.lines) {
    const key = JSON.stringify([line.kind, line.concept, line.description, line.type, line.typeLawDeductionsId])
    const row = rows.get(key)
    if (row) row.amount += cents(line.amount)
    else rows.set(key, { key, label: concepts.find(concept => concept.code === line.concept)?.name ?? defaultConcepts.find(concept => concept.code === (line.mapping ?? line.concept))?.name ?? (line.kind === 'accrued' ? 'Otro ingreso' : 'Otra deducción'),
      description: line.description, kind: line.kind, amount: cents(line.amount) })
  }
  return [...rows.values()].map(row => ({ ...row, amount: money(row.amount) }))
}

export default function PayrollMonthlyEmployeeModal({ employee, monthLabel, status, errors, busy, concepts, onClose, onEditEmployee }: {
  employee: PayrollMonth['employees'][number]; monthLabel: string; status: string; errors: string[]; busy: boolean;
  concepts?: Concept[]; onClose: () => void;
  onEditEmployee?: () => void;
}) {
  const titleId = useId()
  const [view, setView] = useState<PayrollEmployeeView>('month')
  const documents = payrollEmployeeDocuments(employee.documents, view)
  const total = payrollMonthTotals(documents)
  const rows = payrollEmployeeConcepts(documents, concepts)
  const views: { key: PayrollEmployeeView; label: string }[] = [
    { key: 'month', label: 'Mes completo' }, { key: 'first', label: 'Primera quincena' }, { key: 'second', label: 'Segunda quincena' },
  ]
  return <Modal isOpen size="lg" busy={busy} labelledBy={titleId} className="payroll-employee-modal" onClose={onClose}>
    <h2 className="modal-dialog__title" id={titleId}>{employeeName(employee.employee)}</h2>
    <div className="payroll-employee-modal__meta"><span>{employee.employee.identification} · {monthLabel}</span><span className={`payroll__badge payroll__badge--${status}`}>{statusLabels[status] ?? status}</span>
      {onEditEmployee && <button type="button" className="payroll__button" disabled={busy} onClick={onEditEmployee}>Editar empleado</button>}
    </div>
    <div className="payroll-employee-modal__views" role="group" aria-label="Período del detalle">
      {views.map(item => <button type="button" key={item.key} className={`payroll__button${view === item.key ? ' payroll__button--primary' : ''}`} aria-pressed={view === item.key} onClick={() => setView(item.key)}>{item.label}</button>)}
    </div>
    {documents.length ? <>
      <div className="payroll-employee-modal__totals">
        <div><span>Ingresos</span><strong>{currency(total.accrued)}</strong></div>
        <div><span>Deducciones</span><strong>{currency(total.deductions)}</strong></div>
        <div><span>Neto {view === 'month' ? 'del mes' : 'de la quincena'}</span><strong>{currency(total.net)}</strong></div>
      </div>
      <p className="payroll__muted">{documents.map(document => `${document.state.startDate.split('-').reverse().join('/')} – ${document.state.endDate.split('-').reverse().join('/')}`).join(' · ')}</p>
      <div className="payroll-employee-modal__table"><table>
        <thead><tr><th>Concepto</th><th>Ingresos</th><th>Deducciones</th></tr></thead>
        <tbody>{rows.map(row => <tr key={row.key}><td>{row.label}{row.description && <small>{row.description}</small>}</td><td>{row.kind === 'accrued' ? currency(row.amount) : ''}</td><td>{row.kind === 'deduction' ? currency(row.amount) : ''}</td></tr>)}</tbody>
      </table></div>
    </> : <p className="payroll__notice">No hay un registro separado para esta quincena. Si la nómina se registró como un período mensual, puedes consultar sus valores en «Mes completo».</p>}
    <PayrollSubmissionFeedback errors={errors} />
  </Modal>
}
