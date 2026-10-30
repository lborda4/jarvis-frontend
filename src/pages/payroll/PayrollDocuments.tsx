import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import * as XLSX from 'xlsx'
import {
  SearchIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '../../components/icons/SidebarIcons'
import {
  payrollService,
  type PayrollDetail,
  type PayrollDocument,
  type PayrollState,
} from '../../services/payrollService'
import { cents, money } from '../../utils/payrollDomain'
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
import PayrollEditor from './PayrollEditor'
import PayrollImport from './PayrollImport'
import PayrollRowActions from './PayrollRowActions'
import { useJarvisBackAction } from '../../hooks/useJarvisBackAction'
import {
  groupPayrollPeriods,
  payrollPeriodKey,
  periodLabel,
} from './payrollPeriods'
const pageSize = 10
export default function PayrollDocuments(context: PayrollContext) {
  const { data, run, busy } = context
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [year, setYear] = useState(
      params.get('year') ?? localDate().slice(0, 4),
    ),
    [search, setSearch] = useState(''),
    [status, setStatus] = useState(''),
    [page, setPage] = useState(1)
  const [documents, setDocuments] = useState<PayrollDocument[]>([]),
    [loaded, setLoaded] = useState(false),
    [loadError, setLoadError] = useState('')
  const [editor, setEditor] = useState<{
      id?: string
      state?: PayrollState
      detail?: PayrollDetail
      readOnly?: boolean
    } | null>(null),
    [importing, setImporting] = useState(false),
    [detail, setDetail] = useState<PayrollDetail | null>(null)
  const [selected, setSelected] = useState<string[]>([]),
    [confirmBulk, setConfirmBulk] = useState(false),
    [bulkResult, setBulkResult] = useState<string[]>([])
  const [deleteTarget, setDeleteTarget] = useState<PayrollDocument | null>(null)
  const [employeeAction, setEmployeeAction] = useState<{ action: 'edit' | 'delete'; documents: PayrollDocument[] } | null>(null)
  const [detailPeriod, setDetailPeriod] = useState<string | null>(
    params.get('period') ??
      (params.get('employee') ? localDate().slice(0, 7) : null),
  )
  const period = detailPeriod?.includes('|')
    ? detailPeriod.slice(0, 7)
    : `${year}-${localDate().slice(5, 7)}`
  useJarvisBackAction(() => {
    if (busy) return
    if (editor) setEditor(null)
    else {
      setDetailPeriod(null)
      setSearch('')
      setStatus('')
      setSelected([])
      setPage(1)
    }
  }, Boolean(editor || detailPeriod))
  const years = [
    ...new Set([
      year,
      localDate().slice(0, 4),
      String(Number(localDate().slice(0, 4)) - 1),
      String(Number(localDate().slice(0, 4)) - 2),
      ...documents.map((d) => d.state.startDate.slice(0, 4)),
    ]),
  ]
    .sort()
    .reverse()
  const reload = useCallback(async () => {
    const list = await payrollService.list()
    setDocuments(list)
    setLoaded(true)
    setSelected([])
    setLoadError('')
  }, [])
  useEffect(() => {
    let active = true
    void payrollService
      .list()
      .then((list) => {
        if (active) {
          setDocuments(list)
          setLoaded(true)
          setSelected([])
          setLoadError('')
        }
      })
      .catch(() => {
        if (active) {
          setLoadError('No se pudieron cargar las nóminas.')
          setLoaded(true)
        }
      })
    return () => {
      active = false
    }
  }, [])
  const annualDocuments = documents.filter(
    (d) =>
      d.state.startDate.startsWith(`${year}-`) &&
      (!params.get('employee') || d.employeeId === params.get('employee')),
  )
  const groups = groupPayrollPeriods(annualDocuments).filter(
    (group) =>
      (!status || group.status === status) &&
      `${group.label} ${group.monthLabel} ${group.period} ${group.type} ${group.start} ${group.end}`
        .toLocaleLowerCase('es')
        .includes(search.toLocaleLowerCase('es').trim()),
  )
  const filtered = annualDocuments.filter(
    (d) =>
      (!status || d.status === status) &&
      (!params.get('employee') || d.employeeId === params.get('employee')) &&
      `${employeeName(d.employee)} ${d.employee.identification} ${d.prefix ?? ''}${d.number ?? ''}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  )
  const visible = filtered.filter(
    (d) =>
      !detailPeriod ||
      (detailPeriod.includes('|')
        ? payrollPeriodKey(d) === detailPeriod
        : d.state.period === detailPeriod),
  )
  const sum = (key: 'accrued' | 'deductions' | 'net') =>
    money(visible.reduce((s, d) => s + cents(d[key]), 0n))
  const totalRows = detailPeriod ? visible.length : groups.length
  const pageCount = Math.max(1, Math.ceil(totalRows / pageSize))
  const currentPage = Math.min(page, pageCount)
  const periodRows = groups.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  )
  const rows = visible.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  )
  const openPeriod = (key: string) => {
    setDetailPeriod(key)
    setSearch('')
    setStatus('')
    setSelected([])
    setPage(1)
  }
  const open = async (d: PayrollDocument, edit = false) => {
    await run(async () => {
      const full = await payrollService.get(d.id)
      setEditor({ id: d.id, state: full.state, detail: full, readOnly: !edit })
    }, '')
  }
  const actOnPeriod = (key: string, action: 'edit' | 'delete') => {
    const candidates = annualDocuments.filter(document => payrollPeriodKey(document) === key && (action === 'edit' ? ['DRAFT', 'REJECTED'].includes(document.status) : document.canDelete))
    if (candidates.length === 1) {
      if (action === 'edit') void open(candidates[0], true)
      else setDeleteTarget(candidates[0])
    } else if (candidates.length > 1) setEmployeeAction({ action, documents: candidates })
  }
  const adjustment = async (d: PayrollDocument, type: number) => {
    await run(async () => {
      const full = await payrollService.get(d.id)
      setEditor({
        state: {
          ...full.state,
          originalId: d.id,
          noteType: type,
          issueDate: localDate(),
        },
        detail: full,
      })
    }, '')
  }
  const exportExcel = () => {
    const sheet = XLSX.utils.json_to_sheet(
      visible.map((d) => ({
        Documento: `${d.prefix ?? ''}${d.number ?? ''}`,
        Empleado: employeeName(d.employee),
        Identificacion: d.employee.identification,
        Periodo: d.state.period,
        Devengados: d.accrued,
        Deducciones: d.deductions,
        Neto: d.net,
        Estado: statusLabels[d.status],
      })),
    )
    const book = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(book, sheet, 'Nóminas')
    XLSX.writeFile(book, `Nomina-${period}.xlsx`)
  }
  const bulk = async () => {
    setConfirmBulk(false)
    const results: string[] = []
    await run(async () => {
      for (const id of selected) {
        const d = documents.find((v) => v.id === id)!
        try {
          await payrollService.send(id)
          results.push(
            `${employeeName(d.employee)}: solicitud procesada; consulta el resultado.`,
          )
        } catch {
          results.push(
            `${employeeName(d.employee)}: no se pudo confirmar el envío. Revisa el resultado individual.`,
          )
        }
      }
      await reload()
      setBulkResult(results)
    }, 'Procesamiento masivo finalizado.')
  }
  return (
    <>
      <PayrollHeading
        title={
          editor
            ? 'Nómina electrónica'
            : detailPeriod
              ? (groupPayrollPeriods(annualDocuments).find(
                  (group) => group.key === detailPeriod,
                )?.label ??
                `Nómina de ${periodLabel(period).toLocaleLowerCase('es')}`)
              : 'Nóminas'
        }
        description={
          detailPeriod || editor
            ? 'Administra los empleados y novedades de este período.'
            : 'Gestiona tus períodos de nómina electrónica.'
        }
        actions={
          !editor && (
            <>
              <select
                aria-label="Año de nómina"
                className="payroll__year"
                value={year}
                onChange={(e) => {
                  setYear(e.target.value)
                  setPage(1)
                  setDetailPeriod(null)
                  setSelected([])
                  setSearch('')
                  setStatus('')
                }}
              >
                {years.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
              <button
                className="payroll__button payroll__button--primary"
                onClick={() => navigate(`/nomina/nueva?period=${period}`)}
              >
                + Nueva nómina (por período)
              </button>
              <details className="payroll__header-menu payroll__actions">
                <summary aria-label="Más opciones de nómina">•••</summary>
                <div className="payroll__menu">
                  <button
                    type="button"
                    onClick={(e) => {
                      setImporting(true)
                      e.currentTarget
                        .closest('details')
                        ?.removeAttribute('open')
                    }}
                  >
                    Importar Excel
                  </button>
                </div>
              </details>
            </>
          )
        }
      />
      {editor ? (
        <PayrollEditor
          {...context}
          initial={editor.state}
          documentId={editor.id}
          parameterSnapshot={editor.detail?.parameter_snapshot}
          employeeSnapshot={editor.detail?.employee_snapshot}
          readOnly={editor.readOnly}
          onClose={() => setEditor(null)}
          onSaved={reload}
        />
      ) : (
        <>
          {detailPeriod && (
            <div className="payroll__toolbar">
              <button
                className="payroll__button"
                onClick={() => {
                  setDetailPeriod(null)
                  setSearch('')
                  setStatus('')
                  setSelected([])
                  setPage(1)
                }}
              >
                ← Períodos
              </button>
              <button className="payroll__button" onClick={exportExcel}>
                Exportar Excel
              </button>
              <span>
                Total devengados: <strong>{currency(sum('accrued'))}</strong> ·
                Deducciones: <strong>{currency(sum('deductions'))}</strong> ·
                Neto: <strong>{currency(sum('net'))}</strong>
              </span>
            </div>
          )}
          {loadError && (
            <div
              className="payroll__notice payroll__notice--error"
              role="alert"
            >
              {loadError}{' '}
              <button
                className="payroll__link"
                onClick={() => void run(reload, '')}
              >
                Reintentar
              </button>
            </div>
          )}
          <section className="payroll__card payroll__period-card">
            <div className="payroll__filters payroll__period-filters">
              <label className="payroll__period-search">
                <span className="payroll__sr-only">
                  {detailPeriod
                    ? 'Buscar empleado o documento'
                    : 'Buscar período'}
                </span>
                <span className="payroll__search-control">
                  <SearchIcon />
                  <input
                    placeholder={
                      detailPeriod
                        ? 'Buscar empleado (nombre o identificación)'
                        : 'Buscar período (mes o año)'
                    }
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value)
                      setPage(1)
                    }}
                  />
                </span>
              </label>
              <Field label="Estado">
                <select
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value)
                    setPage(1)
                  }}
                >
                  <option value="">Todos</option>
                  {Object.entries(statusLabels).map(([key, name]) => (
                    <option key={key} value={key}>
                      {name}
                    </option>
                  ))}
                </select>
              </Field>
              <button
                className="payroll__clear-filters"
                onClick={() => {
                  setSearch('')
                  setStatus('')
                  setPage(1)
                }}
              >
                <span aria-hidden="true">↻</span> Limpiar filtros
              </button>
            </div>
            {!loaded ? (
              <div className="payroll__empty">Cargando nóminas…</div>
            ) : detailPeriod && !visible.length ? (
              <div className="payroll__empty">
                No hay nóminas para este período y estos filtros.
              </div>
            ) : !detailPeriod ? (
              <div className="payroll__scroll">
                <table>
                  <thead>
                    <tr>
                      {[
                        'Período',
                        'Tipo de liquidación',
                        'Fecha inicial',
                        'Fecha final',
                        'Empleados',
                        'Total ingresos',
                        'Total deducciones',
                        'Total neto',
                        'Estado',
                        'Acciones',
                      ].map((h) => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {periodRows.map((group) => (
                      <tr key={group.key}>
                        <td>
                          <button
                            className="payroll__link payroll__period-link"
                            onClick={() => openPeriod(group.key)}
                          >
                            <span>
                              {group.label}
                              {group.label !== group.monthLabel && (
                                <small>{group.monthLabel}</small>
                              )}
                            </span>
                            <ChevronRightIcon />
                          </button>
                        </td>
                        <td>{group.type}</td>
                        <td>{group.start.split('-').reverse().join('/')}</td>
                        <td>{group.end.split('-').reverse().join('/')}</td>
                        <td>{group.employees}</td>
                        <td>{currency(group.accrued)}</td>
                        <td>{currency(group.deductions)}</td>
                        <td>{currency(group.net)}</td>
                        <td>
                          <span
                            className={`payroll__badge payroll__badge--${group.status}`}
                          >
                            {group.status !== 'DRAFT' && <><span aria-hidden="true">
                              {group.status === 'ACCEPTED'
                                ? '✓'
                                : group.status === 'REJECTED'
                                  ? '!'
                                  : '•'}
                            </span>{' '}</>}
                            {group.statusLabel}
                          </span>
                        </td>
                        <td>
                          <PayrollRowActions
                            name={`${group.label}, ${group.type}`}
                            disabled={busy}
                            actions={[
                              ...(annualDocuments.some(document => payrollPeriodKey(document) === group.key && ['DRAFT', 'REJECTED'].includes(document.status)) ? [{ label: 'Editar', onClick: () => actOnPeriod(group.key, 'edit') }] : []),
                              ...(annualDocuments.some(document => payrollPeriodKey(document) === group.key && document.canDelete) ? [{ label: 'Eliminar', danger: true, onClick: () => actOnPeriod(group.key, 'delete') }] : []),
                            ]}
                          />
                        </td>
                      </tr>
                    ))}
                    {!groups.length && (
                      <tr>
                        <td colSpan={10} className="payroll__empty">
                          No hay períodos de nómina para el año y los filtros
                          seleccionados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="payroll__scroll">
                <table>
                  <thead>
                    <tr>
                      <th>
                        <input
                          type="checkbox"
                          aria-label="Seleccionar borradores visibles"
                          checked={
                            rows.filter((d) => d.status === 'DRAFT').length >
                              0 &&
                            rows
                              .filter((d) => d.status === 'DRAFT')
                              .every((d) => selected.includes(d.id))
                          }
                          onChange={(e) =>
                            setSelected(
                              e.target.checked
                                ? rows
                                    .filter((d) => d.status === 'DRAFT')
                                    .map((d) => d.id)
                                : [],
                            )
                          }
                        />
                      </th>
                      {[
                        'Documento',
                        'Empleado',
                        'Identificación',
                        'Período',
                        'Devengados',
                        'Deducciones',
                        'Neto',
                        'Estado',
                        'Acciones',
                      ].map((h) => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows
                      .filter(
                        (d) =>
                          !detailPeriod.includes('|') ||
                          payrollPeriodKey(d) === detailPeriod,
                      )
                      .map((d) => (
                        <tr key={d.id}>
                          <td>
                            {d.status === 'DRAFT' && (
                              <input
                                type="checkbox"
                                aria-label={`Seleccionar ${employeeName(d.employee)}`}
                                checked={selected.includes(d.id)}
                                onChange={(e) =>
                                  setSelected(
                                    e.target.checked
                                      ? [...selected, d.id]
                                      : selected.filter((id) => id !== d.id),
                                  )
                                }
                              />
                            )}
                          </td>
                          <td>
                            {d.number
                              ? `${d.prefix}${d.number}`
                              : 'Sin asignar'}
                            {d.originalId && <small>Nota de ajuste</small>}
                          </td>
                          <td>
                            <button
                              className="payroll__link"
                              onClick={() => void open(d)}
                            >
                              {employeeName(d.employee)}
                            </button>
                          </td>
                          <td>{d.employee.identification}</td>
                          <td>
                            {d.state.startDate} / {d.state.endDate}
                          </td>
                          <td>{currency(d.accrued)}</td>
                          <td>{currency(d.deductions)}</td>
                          <td>{currency(d.net)}</td>
                          <td>
                            <span
                              className={`payroll__badge payroll__badge--${d.status}`}
                            >
                              {statusLabels[d.status]}
                            </span>
                          </td>
                          <td>
                            <PayrollRowActions
                              name={employeeName(d.employee)}
                              disabled={busy}
                              actions={[
                                ...(['DRAFT', 'REJECTED'].includes(d.status) ? [{ label: 'Editar', onClick: () => void open(d, true) }] : []),
                                ...(d.canDelete ? [{ label: 'Eliminar', danger: true, onClick: () => setDeleteTarget(d) }] : []),
                                { label: 'Resultado', onClick: () => void run(async () => { setDetail(await payrollService.get(d.id)) }, '') },
                                ...(d.status === 'ACCEPTED' ? [
                                  { label: 'Nota de reemplazo', onClick: () => void adjustment(d, 1) },
                                  { label: 'Nota de eliminación', onClick: () => void adjustment(d, 2) },
                                ] : []),
                              ]}
                            />
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
            {(shouldShowTablePagination(totalRows, pageSize) || selected.length > 0) && <div className="payroll__footer">
              {shouldShowTablePagination(totalRows, pageSize) && (
                <nav
                  className="payroll__pagination"
                  aria-label={
                    detailPeriod
                      ? 'Páginas de documentos'
                      : 'Páginas de períodos'
                  }
                >
                  <button
                    className="payroll__button"
                    aria-label="Página anterior"
                    disabled={currentPage <= 1}
                    onClick={() => setPage(currentPage - 1)}
                  >
                    <ChevronLeftIcon />
                  </button>
                  {Array.from({ length: pageCount }, (_, i) => i + 1)
                    .filter(
                      (value) =>
                        value === 1 ||
                        value === pageCount ||
                        Math.abs(value - currentPage) <= 1,
                    )
                    .map((value, index, pages) => (
                      <span key={value}>
                        {index > 0 && value - pages[index - 1] > 1 && (
                          <span className="payroll__pagination-gap">…</span>
                        )}
                        <button
                          className="payroll__button"
                          aria-label={`Página ${value}`}
                          aria-current={
                            value === currentPage ? 'page' : undefined
                          }
                          onClick={() => setPage(value)}
                        >
                          {value}
                        </button>
                      </span>
                    ))}
                  <button
                    className="payroll__button"
                    aria-label="Página siguiente"
                    disabled={currentPage >= pageCount}
                    onClick={() => setPage(currentPage + 1)}
                  >
                    <ChevronRightIcon />
                  </button>
                </nav>
              )}
              {!!selected.length && (
                <button
                  className="payroll__button payroll__button--primary"
                  disabled={busy}
                  onClick={() => setConfirmBulk(true)}
                >
                  Enviar {selected.length} borradores
                </button>
              )}
            </div>}
          </section>
          {!!bulkResult.length && (
            <div className="payroll__card payroll__section">
              <h2>Resultado del procesamiento masivo</h2>
              {bulkResult.map((r) => (
                <p key={r}>{r}</p>
              ))}
            </div>
          )}
        </>
      )}
      {importing && (
        <PayrollImport
          kind="documents"
          data={data}
          run={run}
          busy={busy}
          onClose={() => {
            setImporting(false)
            void reload()
          }}
        />
      )}
      {employeeAction && (
        <Modal title={employeeAction.action === 'edit' ? 'Editar nómina de un empleado' : 'Eliminar nómina de un empleado'} onClose={() => setEmployeeAction(null)}>
          <p>Selecciona el empleado. La acción se aplicará únicamente a su nómina.</p>
          <div className="payroll__toolbar">
            {employeeAction.documents.map(document => <button type="button" className="payroll__button" key={document.id} disabled={busy} onClick={() => {
              const action = employeeAction.action
              setEmployeeAction(null)
              if (action === 'edit') void open(document, true)
              else setDeleteTarget(document)
            }}>{employeeName(document.employee)} · {document.employee.identification}</button>)}
          </div>
        </Modal>
      )}
      {deleteTarget && (
        <Modal title="Eliminar borrador de nómina" onClose={() => { if (!busy) setDeleteTarget(null) }}>
          <p>Se eliminará la nómina de {employeeName(deleteTarget.employee)} del período {deleteTarget.state.startDate.split('-').reverse().join('/')} al {deleteTarget.state.endDate.split('-').reverse().join('/')}. Esta acción no se puede deshacer.</p>
          <div className="payroll__toolbar">
            <button type="button" className="payroll__button" disabled={busy} onClick={() => setDeleteTarget(null)}>Cancelar</button>
            <button type="button" className="payroll__button payroll__button--danger" disabled={busy} onClick={() => void (async () => {
              const ok = await run(async () => {
                await payrollService.deleteDocument(deleteTarget.id)
                await reload()
              }, 'Borrador de nómina eliminado.')
              if (ok) setDeleteTarget(null)
            })()}>{busy ? 'Eliminando…' : 'Eliminar'}</button>
          </div>
        </Modal>
      )}
      {confirmBulk && (
        <Modal
          title="Confirmar envío masivo"
          onClose={() => setConfirmBulk(false)}
        >
          <p>
            Se enviarán {selected.length} nóminas individualmente en ambiente de{' '}
            {data.settings.environment === 1 ? 'producción' : 'pruebas'}. Cada
            una se validará antes de transmitir.
          </p>
          <button
            disabled={busy}
            className="payroll__button payroll__button--primary"
            onClick={() => void bulk()}
          >
            Confirmar envío
          </button>
        </Modal>
      )}
      {detail && (
        <Modal title="Resultado de nómina" onClose={() => setDetail(null)}>
          <p>
            <span className={`payroll__badge payroll__badge--${detail.status}`}>
              {statusLabels[detail.status]}
            </span>
          </p>
          {detail.cune && (
            <Field label="CUNE">
              <input
                readOnly
                value={detail.cune}
                onFocus={(e) => e.target.select()}
              />
            </Field>
          )}
          {!detail.transmissions.length && (
            <p>Esta nómina aún no se ha transmitido.</p>
          )}
          {detail.transmissions.map((t) => (
            <details key={t.id} open>
              <summary>
                {new Date(t.created_at).toLocaleString('es-CO')} · Resultado de
                validación
              </summary>
              {t.error && <p role="alert">{t.error}</p>}
              <pre>{JSON.stringify(t.validation ?? t.response, null, 2)}</pre>
            </details>
          ))}
          <div className="payroll__toolbar">
            {detail.cune && (
              <button
                disabled={busy}
                className="payroll__button"
                onClick={() =>
                  void run(async () => {
                    setDetail(await payrollService.status(detail.id))
                    await reload()
                  }, 'Estado actualizado.')
                }
              >
                Actualizar resultado DIAN
              </button>
            )}
            {[
              ...new Map((detail.files ?? []).map((f) => [f.kind, f])).values(),
            ].map((f) => (
              <button
                key={f.kind}
                disabled={busy}
                className="payroll__button"
                onClick={() =>
                  void run(async () => {
                    const blob = await payrollService.download(
                      detail.id,
                      f.kind,
                    )
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = f.filename
                    a.click()
                    setTimeout(() => URL.revokeObjectURL(url), 1000)
                  }, '')
                }
              >
                Descargar {f.kind.toUpperCase()}
              </button>
            ))}
          </div>
          {detail.status === 'UNCERTAIN' && (
            <p className="payroll__notice">
              El envío requiere confirmación del proveedor antes de reenviar. No
              se generan duplicados automáticamente.
            </p>
          )}
        </Modal>
      )}
    </>
  )
}
