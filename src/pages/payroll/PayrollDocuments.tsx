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
import { filterPayrollList, payrollListStatusOptions } from './payrollListPresentation'
import PayrollDocumentTable from './PayrollDocumentTable'
import PayrollPeriodAccordion from './PayrollPeriodAccordion'
import './PayrollDocuments.css'
import { shouldShowTablePagination } from '../../utils/tablePagination'
import {
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
import { duplicatePayrollState } from '../../utils/documentDuplication'
import PayrollNovelties from './PayrollNovelties'
import PayrollImport from './PayrollImport'
import PayrollRowActions from './PayrollRowActions'
import { useJarvisBackAction } from '../../hooks/useJarvisBackAction'
import {
  groupPayrollPeriods,
  payrollPeriodKey,
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
  const [employeeAction, setEmployeeAction] = useState<{
    action: 'edit' | 'delete'
    documents: PayrollDocument[]
  } | null>(null)
  const [detailPeriod, setDetailPeriod] = useState<string | null>(
    params.get('period') ??
      (params.get('employee') ? localDate().slice(0, 7) : null),
  )
  const isSummaryView = Boolean(
    detailPeriod && params.get('view') === 'summary',
  )
  const period = detailPeriod?.includes('|')
    ? detailPeriod.slice(0, 7)
    : `${year}-${localDate().slice(5, 7)}`
  useJarvisBackAction(
    () => {
      if (busy) return
      if (editor) setEditor(null)
      else {
        setDetailPeriod(null)
        setSearch('')
        setStatus('')
        setSelected([])
        setPage(1)
      }
    },
    Boolean(editor || (detailPeriod && (isSummaryView || params.get('view') === 'novelties' || params.has('employee')))),
  )
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
  const statusScope = annualDocuments.filter(document => !isSummaryView ||
    (detailPeriod!.includes('|') ? payrollPeriodKey(document) === detailPeriod : document.state.period === detailPeriod))
  const statusOptions = payrollListStatusOptions(filterPayrollList(statusScope, search, ''))
  const effectiveStatus = statusOptions.some(option => option.value === status) ? status : ''
  const matchingDocuments = filterPayrollList(annualDocuments, search, effectiveStatus)
  const groups = groupPayrollPeriods(matchingDocuments)
  const filtered = matchingDocuments
  const visible = filtered.filter(
    (d) =>
      !detailPeriod ||
      (detailPeriod.includes('|')
        ? payrollPeriodKey(d) === detailPeriod
        : d.state.period === detailPeriod),
  )
  const totalRows = isSummaryView ? visible.length : groups.length
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
    setDetailPeriod((current) => (current === key ? null : key))
    setSelected([])
  }
  const open = async (d: PayrollDocument, edit = false) => {
    await run(async () => {
      const full = await payrollService.get(d.id)
      setEditor({ id: d.id, state: full.state, detail: full, readOnly: !edit })
    }, '')
  }
  const actOnPeriod = (key: string, action: 'edit' | 'delete') => {
    const candidates = matchingDocuments.filter(
      (document) =>
        payrollPeriodKey(document) === key &&
        (action === 'edit'
          ? ['DRAFT', 'REJECTED'].includes(document.status)
          : document.canDelete),
    )
    if (candidates.length === 1) {
      if (action === 'edit') void open(candidates[0], true)
      else setDeleteTarget(candidates[0])
    } else if (candidates.length > 1)
      setEmployeeAction({ action, documents: candidates })
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
  const duplicate = async (document: PayrollDocument) => {
    await run(async () => {
      const full = await payrollService.get(document.id)
      setEditor({ state: duplicatePayrollState(full.state, localDate()) })
    }, 'Copia lista para revisar. Se actualizó la fecha de emisión y el período al mes actual; revisa las fechas de las novedades antes de guardar.')
  }
  const exportExcel = (items = isSummaryView ? visible : matchingDocuments) => {
    const sheet = XLSX.utils.json_to_sheet(
      items.map((d) => ({
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
    XLSX.writeFile(book, `Nomina-${items[0]?.state.period ?? year}.xlsx`)
  }
  const documentActions = (document: PayrollDocument) => [
    ...(!document.originalId
      ? [{ label: 'Duplicar', onClick: () => void duplicate(document) }]
      : []),
    ...(['DRAFT', 'REJECTED'].includes(document.status)
      ? [{ label: 'Editar', onClick: () => void open(document, true) }]
      : []),
    ...(document.canDelete
      ? [
          {
            label: 'Eliminar',
            danger: true,
            onClick: () => setDeleteTarget(document),
          },
        ]
      : []),
    {
      label: 'Resultado',
      onClick: () =>
        void run(async () => {
          setDetail(await payrollService.get(document.id))
        }, ''),
    },
    ...(document.status === 'ACCEPTED'
      ? [
          {
            label: 'Nota de reemplazo',
            onClick: () => void adjustment(document, 1),
          },
          {
            label: 'Nota de eliminación',
            onClick: () => void adjustment(document, 2),
          },
        ]
      : []),
  ]
  const backToPeriods = () => {
    setDetailPeriod(null)
    setSearch('')
    setStatus('')
    setSelected([])
    setPage(1)
    navigate(`/nomina?year=${year}`, { replace: true })
  }
  const manageNovelties = (key: string) => {
    setDetailPeriod(key)
    navigate(
      `/nomina?period=${encodeURIComponent(key)}&year=${year}&view=novelties`,
      { replace: true },
    )
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
  if (detailPeriod && params.get('view') === 'novelties' && !editor) {
    return (
      <PayrollNovelties
        context={context}
        documents={annualDocuments.filter((document) =>
          detailPeriod.includes('|')
            ? payrollPeriodKey(document) === detailPeriod
            : document.state.period === detailPeriod,
        )}
        allDocuments={documents}
        reload={reload}
        onBack={() => {
          setDetailPeriod(null)
          setSearch('')
          setStatus('')
          setPage(1)
          navigate(`/nomina?year=${year}`, { replace: true })
        }}
        onFinish={() =>
          navigate(
            `/nomina?period=${encodeURIComponent(detailPeriod)}&year=${year}&view=summary`,
            { replace: true },
          )
        }
        onOpenDocument={(document) =>
          void open(document, ['DRAFT', 'REJECTED'].includes(document.status))
        }
      />
    )
  }
  return (
    <div className="payroll__documents">
      <PayrollHeading
        title={
          editor
            ? 'Nómina electrónica'
            : isSummaryView
              ? 'Resumen de nómina'
              : 'Nóminas'
        }
        description={
          editor
            ? 'Revisa y ajusta la nómina del empleado.'
            : isSummaryView
              ? 'Revisa los valores del período antes de enviar la nómina.'
              : 'Organiza tus períodos y consulta los empleados de cada nómina.'
        }
        actions={
          !editor && (
            <>
              {isSummaryView ? (
                <>
                  <button
                    className="payroll__button"
                    disabled={busy}
                    onClick={backToPeriods}
                  >
                    Volver a períodos
                  </button>
                  <button
                    className="payroll__button"
                    disabled={busy}
                    onClick={() => manageNovelties(detailPeriod!)}
                  >
                    Editar novedades
                  </button>
                  <button
                    className="payroll__button"
                    disabled={busy}
                    onClick={() => exportExcel()}
                  >
                    Exportar Excel
                  </button>
                </>
              ) : (
                <>
                  <label className="payroll-register__year">
                    <span>Año</span>
                    <select
                      aria-label="Año de nómina"
                      value={year}
                      disabled={busy}
                      onChange={(event) => {
                        setYear(event.target.value)
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
                  </label>
                  <button
                    className="payroll__button payroll__button--primary"
                    disabled={busy}
                    onClick={() => navigate(`/nomina/nueva?period=${period}`)}
                  >
                    + Nueva nómina
                  </button>
                  <PayrollRowActions
                    name="nóminas"
                    disabled={busy}
                    actions={[
                      {
                        label: 'Importar Excel',
                        onClick: () => setImporting(true),
                      },
                      { label: 'Exportar Excel', onClick: () => exportExcel() },
                    ]}
                  />
                </>
              )}
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
          <section
            className="payroll-register"
            aria-label={
              isSummaryView ? 'Empleados de la nómina' : 'Períodos de nómina'
            }
          >
            <div className="payroll__card payroll-register__filter-card">
              <div className="payroll__filters payroll__period-filters">
                <label className="payroll__period-search">
                  <span className="payroll__sr-only">
                    Buscar período o empleado
                  </span>
                  <span className="payroll__search-control">
                    <SearchIcon />
                    <input
                      placeholder={
                        isSummaryView
                          ? 'Buscar empleado o identificación'
                          : 'Buscar período, empleado o identificación'
                      }
                      value={search}
                      onChange={(event) => {
                        setSearch(event.target.value)
                        const options = payrollListStatusOptions(filterPayrollList(statusScope, event.target.value, ''))
                        setStatus(current => options.some(option => option.value === current) ? current : '')
                        setPage(1)
                        setSelected([])
                      }}
                    />
                  </span>
                </label>
                <Field label="Estado">
                  <select
                    value={effectiveStatus}
                    onChange={(event) => {
                      setStatus(event.target.value)
                      setPage(1)
                      setSelected([])
                    }}
                  >
                    <option value="">Todos</option>
                    {statusOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
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
                    setSelected([])
                  }}
                >
                  <span aria-hidden="true">↻</span> Limpiar filtros
                </button>
              </div>
            </div>
            {!loaded ? (
              <div className="payroll__card payroll__empty">
                Cargando nóminas…
              </div>
            ) : isSummaryView ? (
              <div className="payroll__card payroll-register__summary">
                <div className="payroll-period__toolbar">
                  <div>
                    <h2>
                      {annualDocuments.find(
                        (document) =>
                          payrollPeriodKey(document) === detailPeriod,
                      )?.state.payrollName || 'Empleados del período'}
                    </h2>
                    <p>
                      {detailPeriod
                        ?.split('|')
                        .slice(0, 2)
                        .map((date) => date.split('-').reverse().join('/'))
                        .join(' – ')}
                    </p>
                  </div>
                </div>
                <PayrollDocumentTable
                  documents={rows}
                  selected={selected}
                  busy={busy}
                  onSelection={setSelected}
                  onOpen={(document) => void open(document)}
                  actions={documentActions}
                />
              </div>
            ) : (
              <div className="payroll-register__periods">
                {periodRows.map((group) => {
                  const items = matchingDocuments.filter(
                    (document) => payrollPeriodKey(document) === group.key,
                  )
                  return (
                    <PayrollPeriodAccordion
                      key={group.key}
                      group={group}
                      documents={items}
                      expanded={
                        detailPeriod === group.key ||
                        detailPeriod === group.period
                      }
                      busy={busy}
                      selected={selected}
                      onToggle={() => openPeriod(group.key)}
                      onSelection={setSelected}
                      onOpen={(document) => void open(document)}
                      onNovelties={() => manageNovelties(group.key)}
                      onExport={() => exportExcel(items)}
                      actions={documentActions}
                      periodActions={[
                        ...(items.some((document) =>
                          ['DRAFT', 'REJECTED'].includes(document.status),
                        )
                          ? [
                              {
                                label: 'Editar',
                                onClick: () => actOnPeriod(group.key, 'edit'),
                              },
                            ]
                          : []),
                        ...(items.some((document) => document.canDelete)
                          ? [
                              {
                                label: 'Eliminar',
                                danger: true,
                                onClick: () => actOnPeriod(group.key, 'delete'),
                              },
                            ]
                          : []),
                      ]}
                    />
                  )
                })}
                {!groups.length && (
                  <div className="payroll__card payroll__empty">
                    <h2>No hay nóminas para mostrar</h2>
                    <p>Prueba con otro año o limpia los filtros.</p>
                  </div>
                )}
              </div>
            )}
            {shouldShowTablePagination(totalRows, pageSize) && (
              <nav
                className="payroll__pagination payroll-register__pagination"
                aria-label={
                  isSummaryView ? 'Páginas de empleados' : 'Páginas de períodos'
                }
              >
                <button
                  className="payroll__button"
                  aria-label="Página anterior"
                  disabled={busy || currentPage <= 1}
                  onClick={() => {
                    setPage(currentPage - 1)
                    setSelected([])
                  }}
                >
                  <ChevronLeftIcon />
                </button>
                <span>
                  {currentPage} / {pageCount}
                </span>
                <button
                  className="payroll__button"
                  aria-label="Página siguiente"
                  disabled={busy || currentPage >= pageCount}
                  onClick={() => {
                    setPage(currentPage + 1)
                    setSelected([])
                  }}
                >
                  <ChevronRightIcon />
                </button>
              </nav>
            )}
            {!!selected.length && (
              <div className="payroll-register__selection">
                <strong>
                  {selected.length}{' '}
                  {selected.length === 1
                    ? 'borrador seleccionado'
                    : 'borradores seleccionados'}
                </strong>
                <div className="payroll__toolbar">
                  <button
                    className="payroll__button"
                    disabled={busy}
                    onClick={() => setSelected([])}
                  >
                    Quitar selección
                  </button>
                  <button
                    className="payroll__button payroll__button--primary"
                    disabled={busy}
                    onClick={() => setConfirmBulk(true)}
                  >
                    Enviar {selected.length}{' '}
                    {selected.length === 1 ? 'borrador' : 'borradores'}
                  </button>
                </div>
              </div>
            )}
          </section>
          {!!bulkResult.length && (
            <div className="payroll__card payroll__section">
              <h2>Resultado del procesamiento</h2>
              {bulkResult.map((result) => (
                <p key={result}>{result}</p>
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
        <Modal
          title={
            employeeAction.action === 'edit'
              ? 'Editar nómina de un empleado'
              : 'Eliminar nómina de un empleado'
          }
          onClose={() => setEmployeeAction(null)}
        >
          <p>
            Selecciona el empleado. La acción se aplicará únicamente a su
            nómina.
          </p>
          <div className="payroll__toolbar">
            {employeeAction.documents.map((document) => (
              <button
                type="button"
                className="payroll__button"
                key={document.id}
                disabled={busy}
                onClick={() => {
                  const action = employeeAction.action
                  setEmployeeAction(null)
                  if (action === 'edit') void open(document, true)
                  else setDeleteTarget(document)
                }}
              >
                {employeeName(document.employee)} ·{' '}
                {document.employee.identification}
              </button>
            ))}
          </div>
        </Modal>
      )}
      {deleteTarget && (
        <Modal
          title="Eliminar borrador de nómina"
          onClose={() => {
            if (!busy) setDeleteTarget(null)
          }}
        >
          <p>
            Se eliminará la nómina de {employeeName(deleteTarget.employee)} del
            período{' '}
            {deleteTarget.state.startDate.split('-').reverse().join('/')} al{' '}
            {deleteTarget.state.endDate.split('-').reverse().join('/')}. Esta
            acción no se puede deshacer.
          </p>
          <div className="payroll__toolbar">
            <button
              type="button"
              className="payroll__button"
              disabled={busy}
              onClick={() => setDeleteTarget(null)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="payroll__button payroll__button--danger"
              disabled={busy}
              onClick={() =>
                void (async () => {
                  const ok = await run(async () => {
                    await payrollService.deleteDocument(deleteTarget.id)
                    await reload()
                  }, 'Borrador de nómina eliminado.')
                  if (ok) setDeleteTarget(null)
                })()
              }
            >
              {busy ? 'Eliminando…' : 'Eliminar'}
            </button>
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
    </div>
  )
}
