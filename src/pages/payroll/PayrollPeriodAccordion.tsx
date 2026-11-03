import { useId } from 'react'
import type { PayrollDocument } from '../../services/payrollService'
import {
  ChevronDownIcon,
  ChevronRightIcon,
} from '../../components/icons/SidebarIcons'
import { currency } from './payrollDefaults'
import type { groupPayrollPeriods } from './payrollPeriods'
import PayrollDocumentTable from './PayrollDocumentTable'
import PayrollRowActions, { type PayrollRowAction } from './PayrollRowActions'

export default function PayrollPeriodAccordion({
  group,
  documents,
  expanded,
  busy,
  selected,
  onToggle,
  onSelection,
  onOpen,
  onNovelties,
  onExport,
  actions,
  periodActions,
}: {
  group: ReturnType<typeof groupPayrollPeriods>[number]
  documents: PayrollDocument[]
  expanded: boolean
  busy: boolean
  selected: string[]
  onToggle: () => void
  onSelection: (ids: string[]) => void
  onOpen: (document: PayrollDocument) => void
  onNovelties: () => void
  onExport: () => void
  actions: (document: PayrollDocument) => PayrollRowAction[]
  periodActions: PayrollRowAction[]
}) {
  const regionId = useId(),
    buttonId = useId()
  return (
    <article
      className={`payroll-period${expanded ? ' payroll-period--open' : ''}`}
    >
      <div className="payroll-period__header">
        <button
          id={buttonId}
          type="button"
          className="payroll-period__toggle"
          aria-expanded={expanded}
          aria-controls={regionId}
          disabled={busy}
          onClick={onToggle}
        >
          <span className="payroll-period__chevron" aria-hidden="true">
            {expanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
          </span>
          <span className="payroll-period__name">
            <strong>{group.label}</strong>
            <span>
              {group.type} · {group.start.split('-').reverse().join('/')} –{' '}
              {group.end.split('-').reverse().join('/')}
            </span>
          </span>
          <span className="payroll-period__employees">
            {group.employees} {group.employees === 1 ? 'empleado' : 'empleados'}
          </span>
          <span className="payroll-period__net">
            <small>Neto a pagar</small>
            <strong>{currency(group.net)}</strong>
          </span>
          <span className={`payroll__badge payroll__badge--${group.status}`}>
            {group.statusLabel}
          </span>
        </button>
        <PayrollRowActions
          name={`${group.label}, ${group.type}`}
          disabled={busy}
          actions={periodActions}
        />
      </div>
      {expanded && (
        <section
          id={regionId}
          role="region"
          aria-labelledby={buttonId}
          className="payroll-period__body"
        >
          <div className="payroll-period__toolbar">
            <div>
              <h2>Empleados del período</h2>
              <p>Consulta sus valores y administra las novedades.</p>
            </div>
            <div className="payroll__toolbar">
              <button
                className="payroll__button"
                disabled={busy}
                onClick={onExport}
              >
                Exportar Excel
              </button>
              <button
                className="payroll__button payroll__button--primary"
                disabled={busy}
                onClick={onNovelties}
              >
                Gestionar novedades
              </button>
            </div>
          </div>
          <PayrollDocumentTable
            documents={documents}
            selected={selected}
            busy={busy}
            onSelection={onSelection}
            onOpen={onOpen}
            actions={actions}
          />
          <div className="payroll-period__totals">
            <span>
              Ingresos <strong>{currency(group.accrued)}</strong>
            </span>
            <span>
              Deducciones <strong>{currency(group.deductions)}</strong>
            </span>
            <span>
              Neto <strong>{currency(group.net)}</strong>
            </span>
          </div>
        </section>
      )}
    </article>
  )
}
