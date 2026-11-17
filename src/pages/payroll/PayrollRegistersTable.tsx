import { Fragment, useId, useState } from 'react'
import Modal from '../../components/Modal'
import { ChevronDownIcon, ChevronRightIcon } from '../../components/icons/SidebarIcons'
import type { PayrollDocument } from '../../services/payrollService'
import { shouldShowTablePagination } from '../../utils/tablePagination'
import { currency } from './payrollDefaults'
import { groupPayrollPeriods, payrollPeriodKey } from './payrollPeriods'
import type { PayrollMonth } from './payrollMonths'
import PayrollDocumentTable from './PayrollDocumentTable'
import PayrollRowActions, { type PayrollRowAction } from './PayrollRowActions'
import { payrollAdjustmentLabel } from './payrollAdjustmentTargets'

type Period = ReturnType<typeof groupPayrollPeriods>[number]
type PeriodActions = (period: Period, documents: PayrollDocument[]) => PayrollRowAction[]

export function PayrollPeriodsTable({ documents, busy, onDetails, periodActions }: {
  documents: PayrollDocument[]; busy: boolean; onDetails: (key: string) => void; periodActions: PeriodActions;
}) {
  const originals = documents.filter(document => !document.originalId)
  const periods = groupPayrollPeriods(originals).sort((a, b) => a.start.localeCompare(b.start))
  return <div className="payroll-register-table payroll-register-table--periods" role="region" aria-label="Nóminas del mes" tabIndex={0}>
    <table><thead><tr><th>Nómina / Período</th><th>Empleados</th><th>Ingresos</th><th>Deducciones</th><th>Neto a pagar</th><th>Estado</th><th>Acciones</th></tr></thead>
      <tbody>{periods.map(period => {
        const items = originals.filter(document => payrollPeriodKey(document) === period.key)
        return <tr key={period.key}>
          <td><button className="payroll__link payroll-register-table__name" onClick={() => onDetails(period.key)}>{period.label}</button><small>{period.type} · {period.start.split('-').reverse().join('/')} – {period.end.split('-').reverse().join('/')}</small></td>
          <td>{period.employees}</td><td>{currency(period.accrued)}</td><td>{currency(period.deductions)}</td><td><strong>{currency(period.net)}</strong></td>
          <td><span className={`payroll__badge payroll__badge--${period.status}`}>{period.status === 'DRAFT' ? 'Guardada' : period.statusLabel}</span></td>
          <td><div className="payroll-register-table__actions"><button className="payroll__link" onClick={() => onDetails(period.key)}>Ver empleados</button><PayrollRowActions name={period.label} disabled={busy} actions={periodActions(period, items)} /></div></td>
        </tr>
      })}</tbody>
    </table>
  </div>
}

export default function PayrollRegistersTable({ months, busy, initialMonthKey, onReview, onAdjustment, onNovelties, onPayslip, onExport, onOpen, documentActions, periodActions }: {
  months: PayrollMonth[]; busy: boolean; initialMonthKey?: string;
  onReview: (month: string) => void; onNovelties: (period: string, document?: PayrollDocument) => void;
  onAdjustment?: (month: PayrollMonth, noteType: 1 | 2) => void;
  onPayslip?: (document: PayrollDocument) => Promise<void>;
  onExport: (documents: PayrollDocument[]) => void; onOpen: (document: PayrollDocument) => void;
  documentActions: (document: PayrollDocument) => PayrollRowAction[]; periodActions: PeriodActions;
}) {
  const id = useId()
  const [expandedMonth, setExpandedMonth] = useState<string | null>(initialMonthKey ?? null)
  const [periodKey, setPeriodKey] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [payslipBusy, setPayslipBusy] = useState(false)
  const [payslipError, setPayslipError] = useState('')
  const openPayslip = async (document: PayrollDocument) => {
    if (!onPayslip || payslipBusy || busy) return
    setPayslipBusy(true)
    setPayslipError('')
    try { await onPayslip(document) }
    catch (error) { setPayslipError(error instanceof Error ? error.message : 'No se pudo generar el desprendible. Intenta nuevamente.') }
    finally { setPayslipBusy(false) }
  }
  const allDocuments = months.flatMap(month => month.documents).filter(document => !document.originalId)
  const selectedPeriod = groupPayrollPeriods(allDocuments).find(period => period.key === periodKey)
  const selectedDocuments = allDocuments.filter(document => payrollPeriodKey(document) === periodKey)
  const pageSize = 10
  const pages = Math.max(1, Math.ceil(selectedDocuments.length / pageSize))
  const currentPage = Math.min(page, pages)
  const openPeriod = (key: string) => { setPage(1); setPeriodKey(key) }
  return <>
    <div className="payroll-register-table" role="region" aria-label="Nóminas por mes" tabIndex={0}>
      <table><thead><tr><th>Mes</th><th>Empleados</th><th>Ingresos</th><th>Deducciones</th><th>Neto del mes</th><th>Estado</th><th>Acciones</th></tr></thead>
        <tbody>{months.map(month => <Fragment key={month.key}>
          <tr>
            <td><button type="button" className="payroll__link payroll-register-table__month" aria-expanded={expandedMonth === month.key} aria-controls={`${id}-${month.key}`} disabled={busy} onClick={() => setExpandedMonth(expandedMonth === month.key ? null : month.key)}><span aria-hidden="true">{expandedMonth === month.key ? <ChevronDownIcon /> : <ChevronRightIcon />}</span>{month.label}</button></td>
            <td>{month.employees.length}</td><td>{currency(month.accrued)}</td><td>{currency(month.deductions)}</td><td><strong>{currency(month.net)}</strong></td>
            <td><span className={`payroll__badge payroll__badge--${month.status}`}>{month.statusLabel}</span>
              {[...new Set(month.documents.filter(document => !document.originalId).map(document => payrollAdjustmentLabel(document.adjustment)).filter(Boolean))].map(label => <small key={label}>{label}</small>)}
            </td>
            <td><PayrollRowActions name={month.label} disabled={busy} actions={[
              { label: 'Revisar mes', onClick: () => onReview(month.key) },
              ...(onAdjustment && month.documents.some(document => !document.originalId && (document.monthlySubmission?.status ?? document.status) === 'ACCEPTED' && document.adjustmentTargetId !== null)
                ? [{ label: 'Eliminar', danger: true, onClick: () => onAdjustment(month, 2) },
                  { label: 'Reemplazar', onClick: () => onAdjustment(month, 1) }] : []),
            ]} /></td>
          </tr>
          {expandedMonth === month.key && <tr className="payroll-register-table__expanded"><td colSpan={7} id={`${id}-${month.key}`}>
            <PayrollPeriodsTable documents={month.documents} busy={busy} onDetails={openPeriod} periodActions={periodActions} />
          </td></tr>}
        </Fragment>)}</tbody>
      </table>
    </div>
    {selectedPeriod && <Modal isOpen size="lg" busy={busy || payslipBusy} labelledBy={`${id}-period`} className="payroll-period-modal" onClose={() => setPeriodKey(null)}>
      <h2 className="modal-dialog__title" id={`${id}-period`}>{selectedPeriod.label}</h2>
      <p className="payroll__muted">{selectedPeriod.type} · {selectedPeriod.start.split('-').reverse().join('/')} – {selectedPeriod.end.split('-').reverse().join('/')}</p>
      <div className="payroll-period-modal__toolbar"><span className="payroll__muted">{selectedDocuments.length} empleados</span><div className="payroll__toolbar">
        <button className="payroll__button" disabled={busy} onClick={() => onExport(selectedDocuments)}>Exportar Excel</button>
      </div></div>
      {payslipBusy && <p className="payroll__muted" role="status">Generando desprendible…</p>}
      {payslipError && <p className="payroll__notice payroll__notice--error" role="alert">{payslipError}</p>}
      <PayrollDocumentTable documents={selectedDocuments.slice((currentPage - 1) * pageSize, currentPage * pageSize)} selected={[]} selectable={false} busy={busy || payslipBusy} onSelection={() => {}}
        onPayslip={onPayslip ? document => void openPayslip(document) : undefined}
        onNovelties={document => { setPeriodKey(null); onNovelties(selectedPeriod.key, document) }}
        onOpen={document => { setPeriodKey(null); onOpen(document) }}
        actions={document => documentActions(document).map(action => ({ ...action, onClick: () => { setPeriodKey(null); action.onClick() } }))} />
      {shouldShowTablePagination(selectedDocuments.length, pageSize) && <nav className="payroll__pagination" aria-label="Páginas de empleados del período">
        <button className="payroll__button" disabled={busy || currentPage === 1} onClick={() => setPage(currentPage - 1)}>Anterior</button><span>{currentPage} / {pages}</span><button className="payroll__button" disabled={busy || currentPage === pages} onClick={() => setPage(currentPage + 1)}>Siguiente</button>
      </nav>}
    </Modal>}
  </>
}
