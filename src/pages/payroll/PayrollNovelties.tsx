import { useState } from 'react'
import { getApiErrorMessage } from '../../services/apiClient'
import {
  payrollService,
  type PayrollDetail,
  type PayrollDocument,
  type PayrollState,
} from '../../services/payrollService'
import {
  totals,
  validatePayroll,
  type PayrollLine,
} from '../../utils/payrollDomain'
import { payrollEmploymentDays } from '../../utils/payrollEmployment'
import { shouldShowTablePagination } from '../../utils/tablePagination'
import {
  currency,
  employeeName,
  localDate,
  statusLabels,
} from './payrollDefaults'
import {
  Field,
  Modal,
  PayrollHeading,
  type PayrollContext,
} from './PayrollPage'
import PayrollNoveltyModal from './PayrollNoveltyModal'
import {
  canEditPayrollNovelties,
  payrollNoveltyTotals,
  preparePayrollNovelties,
  stateForAddedPayrollEmployee,
} from './payrollNoveltyDomain'
import './PayrollNovelties.css'

const pageSize = 10
const dateLabel = (date: string) => date.split('-').reverse().join('/')
export default function PayrollNovelties({
  context,
  documents,
  allDocuments,
  reload,
  onBack,
  onFinish,
  onOpenDocument,
}: {
  context: PayrollContext
  documents: PayrollDocument[]
  allDocuments: PayrollDocument[]
  reload: () => Promise<void>
  onBack: () => void
  onFinish: () => void
  onOpenDocument: (document: PayrollDocument) => void
}) {
  const { data, busy, run } = context
  const [search, setSearch] = useState(''),
    [page, setPage] = useState(1)
  const [sort, setSort] = useState<
    'name' | 'identification' | 'count' | 'accrued' | 'deductions' | 'net'
  >('name')
  const [descending, setDescending] = useState(false)
  const [detail, setDetail] = useState<PayrollDetail | null>(null)
  const [novelty, setNovelty] = useState<{
    detail: PayrollDetail
    line?: PayrollLine
  } | null>(null)
  const [addingEmployee, setAddingEmployee] = useState(false),
    [employeeId, setEmployeeId] = useState('')
  const [confirmLiquidate, setConfirmLiquidate] = useState(false)
  const reference = documents[0]
  const configured = [...data.parameters]
    .sort((a, b) => b.validFrom.localeCompare(a.validFrom))
    .find((item) => item.validFrom <= localDate())?.data
  const concepts = configured?.concepts ?? []
  const names = new Map(concepts.map((concept) => [concept.code, concept.name]))
  const nameForLine = (line: PayrollLine, currentDetail?: PayrollDetail) =>
    names.get(line.concept) ??
    currentDetail?.parameter_snapshot.concepts.find(
      (concept) => concept.code === line.concept,
    )?.name ??
    line.concept
  const groupTotal = payrollNoveltyTotals(documents)
  const editable = documents.filter(canEditPayrollNovelties)
  const filtered = documents
    .filter((document) =>
      `${employeeName(document.employee)} ${document.employee.identification} ${document.state.lines.map((line) => nameForLine(line)).join(' ')}`
        .toLocaleLowerCase('es')
        .includes(search.trim().toLocaleLowerCase('es')),
    )
    .sort((a, b) => {
      let result: number
      if (sort === 'name' || sort === 'identification')
        result = (
          sort === 'name' ? employeeName(a.employee) : a.employee.identification
        ).localeCompare(
          sort === 'name'
            ? employeeName(b.employee)
            : b.employee.identification,
          'es',
          { numeric: true },
        )
      else
        result =
          sort === 'count'
            ? a.state.lines.length - b.state.lines.length
            : Number(totals(a.state.lines)[sort]) -
              Number(totals(b.state.lines)[sort])
      return descending ? -result : result
    })
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize)),
    currentPage = Math.min(page, pageCount)
  const rows = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  )
  const sortBy = (key: typeof sort) => {
    if (sort === key) setDescending(!descending)
    else {
      setSort(key)
      setDescending(false)
    }
    setPage(1)
  }
  const loadDetail = async (document: PayrollDocument, add = false) => {
    await run(async () => {
      const result = await payrollService.get(document.id)
      if (add) setNovelty({ detail: result })
      else setDetail(result)
    }, '')
  }
  const saveNovelty = async (state: PayrollState) => {
    if (!novelty) return
    let saveError = 'No se pudo guardar la novedad. Intenta nuevamente.'
    const ok = await run(async () => {
      try {
        await payrollService.save(novelty.detail.id, state)
        await reload()
      } catch (cause) {
        saveError = getApiErrorMessage(cause, saveError)
        throw cause
      }
    }, 'Novedad guardada.')
    if (ok) {
      setNovelty(current => current && ({
        detail: { ...current.detail, state },
      }))
      setDetail(current => current?.id === novelty.detail.id ? { ...current, state } : current)
    } else throw new Error(saveError)
  }
  const removeLine = async (line: PayrollLine) => {
    if (!detail) return
    const next = {
      ...detail.state,
      lines: detail.state.lines.filter((item) => item.id !== line.id),
    }
    const errors = validatePayroll(next, detail.employee_snapshot)
    const ok = await run(async () => {
      if (errors.length) throw new Error(errors.join(' '))
      await payrollService.save(detail.id, next)
      setDetail(await payrollService.get(detail.id))
      await reload()
    }, 'Novedad eliminada.')
    if (!ok) return
  }
  const liquidate = async () => {
    setConfirmLiquidate(false)
    const ok = await run(
      async () => {
        const pending: { id: string; state: PayrollState }[] = []
        for (const document of editable) {
          const full = await payrollService.get(document.id)
          const state = preparePayrollNovelties(full.state)
          const errors = validatePayroll(state, full.employee_snapshot)
          if (!state.lines.some(line => line.kind === 'accrued' && Number(line.amount) > 0))
            errors.push('Ingresa el salario y los demás valores antes de liquidar.')
          if (errors.length)
            throw new Error(
              `${employeeName(full.employee_snapshot)}: ${errors.join(' ')}`,
            )
          pending.push({ id: full.id, state })
        }
        try {
          for (const item of pending)
            await payrollService.save(item.id, item.state)
        } finally {
          await reload()
        }
      },
      'Nómina liquidada. Revisa el resumen y continúa con el envío cuando esté lista.',
    )
    if (ok) onFinish()
  }
  const availableEmployees = reference
    ? data.employees.filter(
        (employee) =>
          employee.active &&
          payrollEmploymentDays(reference.state, employee).days > 0 &&
          !allDocuments.some(
            (document) =>
              document.employeeId === employee.id &&
              !document.originalId &&
              document.state.startDate === reference.state.startDate &&
              document.state.endDate === reference.state.endDate,
          ),
      )
    : []
  const addEmployee = async () => {
    const employee = availableEmployees.find((item) => item.id === employeeId)
    if (!reference || !employee) return
    const ok = await run(async () => {
      const full = await payrollService.get(reference.id)
      await payrollService.save(
        crypto.randomUUID(),
        stateForAddedPayrollEmployee(
          reference.state,
          employee,
          full.parameter_snapshot,
        ),
      )
      await reload()
    }, 'Empleado agregado al período.')
    if (ok) {
      setAddingEmployee(false)
      setEmployeeId('')
    }
  }
  return (
    <>
      <PayrollHeading
        title="Novedades"
        description={
          reference
            ? `${reference.state.payrollName || 'Nómina'} · ${dateLabel(reference.state.startDate)} al ${dateLabel(reference.state.endDate)}`
            : 'Novedades por empleado'
        }
        actions={
          <>
            <button
              className="payroll__button"
              disabled={busy}
              onClick={onBack}
            >
              Regresar
            </button>
            <button
              className="payroll__button payroll__button--primary"
              disabled={busy || !editable.length}
              onClick={() => setConfirmLiquidate(true)}
            >
              Liquidar
            </button>
          </>
        }
      />
      <section className="payroll__card payroll__novelties">
        <div className="payroll__novelties-toolbar">
          <div>
            <h2>Novedades por empleado</h2>
            <span>
              Empleados a liquidar: <strong>{documents.length}</strong>
            </span>
          </div>
          <label className="payroll__novelties-search">
            <span className="payroll__sr-only">
              Buscar por nombre, identificación o concepto
            </span>
            <input
              placeholder="Buscar nombre, identificación o concepto"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
            />
          </label>
          <button
            className="payroll__button payroll__button--primary"
            disabled={busy || !reference?.state.payrollGroupId}
            onClick={() => setAddingEmployee(true)}
          >
            + Agregar empleado
          </button>
        </div>
        <div className="payroll__table-wrap">
          <table className="payroll__novelties-table">
            <thead>
              <tr>
                {(
                  [
                    ['name', 'Nombre'],
                    ['identification', 'Identificación'],
                    ['count', 'Novedades'],
                    ['accrued', 'Ingresos'],
                    ['deductions', 'Deducciones'],
                    ['net', 'Neto a pagar'],
                  ] as const
                ).map(([key, label]) => (
                  <th
                    key={key}
                    aria-sort={
                      sort === key
                        ? descending
                          ? 'descending'
                          : 'ascending'
                        : 'none'
                    }
                  >
                    <button type="button" onClick={() => sortBy(key)}>
                      {label}{' '}
                      <span aria-hidden="true">
                        {sort === key ? (descending ? '↓' : '↑') : '↕'}
                      </span>
                    </button>
                  </th>
                ))}
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((document) => {
                const total = totals(document.state.lines)
                return (
                  <tr key={document.id}>
                    <td>
                      <button
                        type="button"
                        className="payroll__link"
                        disabled={busy}
                        onClick={() => onOpenDocument(document)}
                      >
                        {employeeName(document.employee)}
                      </button>
                      <small className="payroll__muted">
                        {statusLabels[document.status] ?? document.status}
                      </small>
                    </td>
                    <td>{document.employee.identification}</td>
                    <td>
                      <button
                        type="button"
                        className="payroll__link"
                        disabled={busy}
                        onClick={() => void loadDetail(document)}
                      >
                        ({document.state.lines.length}) Ver detalle
                      </button>
                    </td>
                    <td>{currency(total.accrued)}</td>
                    <td>{currency(total.deductions)}</td>
                    <td>
                      <strong>{currency(total.net)}</strong>
                    </td>
                    <td>
                      <button
                        className="payroll__button payroll__button--primary"
                        disabled={busy || !canEditPayrollNovelties(document)}
                        onClick={() => void loadDetail(document, true)}
                      >
                        + Añadir novedad
                      </button>
                    </td>
                  </tr>
                )
              })}
              {!rows.length && (
                <tr>
                  <td colSpan={7} className="payroll__empty">
                    {documents.length
                      ? 'No hay empleados que coincidan con la búsqueda.'
                      : 'Este período no tiene empleados.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {shouldShowTablePagination(filtered.length, pageSize) && (
          <nav className="payroll__footer" aria-label="Páginas de novedades">
            <button
              className="payroll__button"
              disabled={busy || currentPage === 1}
              onClick={() => setPage(currentPage - 1)}
            >
              Anterior
            </button>
            <span>
              {currentPage} / {pageCount}
            </span>
            <button
              className="payroll__button"
              disabled={busy || currentPage === pageCount}
              onClick={() => setPage(currentPage + 1)}
            >
              Siguiente
            </button>
          </nav>
        )}
      </section>
      <div className="payroll__card payroll__novelties-totals">
        <span>
          Total ingresos <strong>{currency(groupTotal.accrued)}</strong>
        </span>
        <span>
          Total deducciones <strong>{currency(groupTotal.deductions)}</strong>
        </span>
        <span>
          Total neto a pagar <strong>{currency(groupTotal.net)}</strong>
        </span>
      </div>
      {novelty && (
        <PayrollNoveltyModal
          detail={novelty.detail}
          concepts={
            concepts.length
              ? concepts
              : novelty.detail.parameter_snapshot.concepts
          }
          initial={novelty.line}
          busy={busy}
          onClose={() => setNovelty(null)}
          onSave={saveNovelty}
        />
      )}
      {detail && (
        <Modal
          title="Novedades del empleado"
          subtitle={employeeName(detail.employee_snapshot)}
          onClose={() => {
            if (!busy) setDetail(null)
          }}
        >
          <div className="payroll__table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Concepto</th>
                  <th>Cantidad</th>
                  <th>Valor</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {detail.state.lines.map((line) => (
                  <tr key={line.id}>
                    <td>
                      {nameForLine(line, detail)}
                      <small>
                        {line.kind === 'accrued' ? 'Ingreso' : 'Deducción'}
                      </small>
                    </td>
                    <td>{line.quantity}</td>
                    <td>{currency(line.amount)}</td>
                    <td>
                      {['DRAFT', 'REJECTED'].includes(detail.status) && (
                        <div className="payroll__toolbar">
                          <button
                            className="payroll__link"
                            disabled={busy}
                            onClick={() => {
                              setNovelty({ detail, line })
                              setDetail(null)
                            }}
                          >
                            Editar
                          </button>
                          <button
                            className="payroll__link"
                            disabled={busy}
                            onClick={() => void removeLine(line)}
                          >
                            Eliminar
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal>
      )}
      {addingEmployee && (
        <Modal
          title="Agregar empleado a la nómina"
          onClose={() => {
            if (!busy) setAddingEmployee(false)
          }}
        >
          <Field label="Empleado">
            <select
              value={employeeId}
              disabled={busy}
              onChange={(event) => setEmployeeId(event.target.value)}
            >
              <option value="">Seleccionar empleado</option>
              {availableEmployees.map((employee) => (
                <option value={employee.id} key={employee.id}>
                  {employeeName(employee)} · {employee.identification}
                </option>
              ))}
            </select>
          </Field>
          {!availableEmployees.length && (
            <p>No hay empleados disponibles para este período.</p>
          )}
          <div className="payroll__toolbar payroll__novelty-actions">
            <button
              className="payroll__button"
              disabled={busy}
              onClick={() => setAddingEmployee(false)}
            >
              Cancelar
            </button>
            <button
              className="payroll__button payroll__button--primary"
              disabled={busy || !employeeId}
              onClick={() => void addEmployee()}
            >
              Agregar empleado
            </button>
          </div>
        </Modal>
      )}
      {confirmLiquidate && (
        <Modal
          title="Liquidar nómina"
          onClose={() => setConfirmLiquidate(false)}
        >
          <p>
            Se guardarán los valores ingresados para {editable.length}{' '}
            empleados antes de revisar el resumen de la nómina.
          </p>
          <div className="payroll__toolbar">
            <button
              className="payroll__button"
              onClick={() => setConfirmLiquidate(false)}
            >
              Cancelar
            </button>
            <button
              className="payroll__button payroll__button--primary"
              disabled={busy}
              onClick={() => void liquidate()}
            >
              Liquidar
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
