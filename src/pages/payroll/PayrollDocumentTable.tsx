import type { PayrollDocument } from '../../services/payrollService'
import { currency, employeeName, statusLabels } from './payrollDefaults'
import PayrollRowActions, { type PayrollRowAction } from './PayrollRowActions'

export default function PayrollDocumentTable({
  documents,
  selected,
  busy,
  onSelection,
  onOpen,
  actions,
}: {
  documents: PayrollDocument[]
  selected: string[]
  busy: boolean
  onSelection: (ids: string[]) => void
  onOpen: (document: PayrollDocument) => void
  actions: (document: PayrollDocument) => PayrollRowAction[]
}) {
  const drafts = documents.filter((document) => document.status === 'DRAFT')
  return (
    <div className="payroll-documents-table">
      <table>
        <colgroup>
          <col className="payroll-documents-table__check" />
          <col className="payroll-documents-table__employee" />
          <col />
          <col />
          <col />
          <col className="payroll-documents-table__status" />
          <col className="payroll-documents-table__actions" />
        </colgroup>
        <thead>
          <tr>
            <th>
              <input
                type="checkbox"
                aria-label="Seleccionar borradores visibles"
                disabled={busy || !drafts.length}
                checked={
                  Boolean(drafts.length) &&
                  drafts.every((document) => selected.includes(document.id))
                }
                onChange={(event) => {
                  const ids = drafts.map((document) => document.id)
                  onSelection(
                    event.target.checked
                      ? [...new Set([...selected, ...ids])]
                      : selected.filter((id) => !ids.includes(id)),
                  )
                }}
              />
            </th>
            <th>Empleado</th>
            <th>Ingresos</th>
            <th>Deducciones</th>
            <th>Neto a pagar</th>
            <th>Estado</th>
            <th>
              <span className="payroll__sr-only">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {documents.map((document) => (
            <tr
              key={document.id}
              className={
                selected.includes(document.id)
                  ? 'payroll-documents-table__selected'
                  : undefined
              }
            >
              <td data-label="Seleccionar">
                {document.status === 'DRAFT' && (
                  <input
                    type="checkbox"
                    disabled={busy}
                    aria-label={`Seleccionar ${employeeName(document.employee)}`}
                    checked={selected.includes(document.id)}
                    onChange={(event) =>
                      onSelection(
                        event.target.checked
                          ? [...new Set([...selected, document.id])]
                          : selected.filter((id) => id !== document.id),
                      )
                    }
                  />
                )}
              </td>
              <td
                data-label="Empleado"
                className="payroll-documents-table__person"
              >
                <button
                  className="payroll__link"
                  disabled={busy}
                  onClick={() => onOpen(document)}
                >
                  {employeeName(document.employee)}
                </button>
                <small>
                  {document.employee.identification} ·{' '}
                  {document.number
                    ? `${document.prefix ?? ''}${document.number}`
                    : 'Sin documento asignado'}
                  {document.originalId ? ' · Nota de ajuste' : ''}
                </small>
              </td>
              <td data-label="Ingresos">{currency(document.accrued)}</td>
              <td data-label="Deducciones">{currency(document.deductions)}</td>
              <td data-label="Neto a pagar">
                <strong>{currency(document.net)}</strong>
              </td>
              <td data-label="Estado">
                <span
                  className={`payroll__badge payroll__badge--${document.status}`}
                >
                  {statusLabels[document.status] ?? document.status}
                </span>
              </td>
              <td data-label="Acciones">
                <PayrollRowActions
                  name={employeeName(document.employee)}
                  disabled={busy}
                  actions={actions(document)}
                />
              </td>
            </tr>
          ))}
          {!documents.length && (
            <tr>
              <td colSpan={7} className="payroll__empty">
                No hay empleados para estos filtros.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
