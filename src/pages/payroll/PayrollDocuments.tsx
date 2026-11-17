import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { openPayrollPayslipPdf } from './payrollPayslipPreview'
import { exportPayrollSummary } from './payrollSummaryExcel'
import {
  SearchIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '../../components/icons/SidebarIcons'
import {
  payrollService,
  type PayrollDocument,
} from '../../services/payrollService'
import { filterPayrollList, payrollListStatusOptions } from './payrollListPresentation'
import PayrollDocumentTable from './PayrollDocumentTable'
import PayrollRegistersTable from './PayrollRegistersTable'
import PayrollPeriodNoveltiesModal from './PayrollPeriodNoveltiesModal'
import PayrollPayslipsModal from './PayrollPayslipsModal'
import { hasUnsavedPayrollNovelties } from './usePayrollNoveltyDrafts'
import PayrollMonthlyReview from './PayrollMonthlyReview'
import { groupPayrollMonths } from './payrollMonths'
import type { PayrollMonth } from './payrollMonths'
import PayrollAdjustmentModal from './PayrollAdjustmentModal'
import './PayrollDocuments.css'
import { shouldShowTablePagination } from '../../utils/tablePagination'
import { getApiErrorMessage } from '../../services/apiClient'
import { payrollSubmissionErrors } from '../../utils/payrollSubmissionErrors'
import {
  employeeName,
  localDate,
} from './payrollDefaults'
import {
  Field,
  Modal,
  PayrollHeading,
  type PayrollContext,
} from './PayrollPage'
import PayrollNovelties from './PayrollNovelties'
import PayrollImport from './PayrollImport'
import PayrollRowActions from './PayrollRowActions'
import { useJarvisBackAction } from '../../hooks/useJarvisBackAction'
import {
  payrollPeriodKey,
} from './payrollPeriods'
const pageSize = 10
export default function PayrollDocuments(context: PayrollContext) {
  const { data, run, busy } = context
  const { user } = useAuth()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [year, setYear] = useState(
      params.get('year') ?? localDate().slice(0, 4),
    ),
    [month, setMonth] = useState(''),
    [search, setSearch] = useState(''),
    [status, setStatus] = useState(''),
    [page, setPage] = useState(1)
  const [documents, setDocuments] = useState<PayrollDocument[]>([]),
    [loaded, setLoaded] = useState(false),
    [loadError, setLoadError] = useState('')
  const [importing, setImporting] = useState(false)
  const [selected, setSelected] = useState<string[]>([]),
    [confirmBulk, setConfirmBulk] = useState(false),
    [sendingName, setSendingName] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<PayrollDocument | null>(null)
  const [reviewMonth, setReviewMonth] = useState<string | null>(null)
  const [noveltyPeriod, setNoveltyPeriod] = useState<string | null>(null)
  const [noveltyDocumentId, setNoveltyDocumentId] = useState<string | null>(null)
  const [payslipDocuments, setPayslipDocuments] = useState<PayrollDocument[] | null>(null)
  const [duplicateError, setDuplicateError] = useState('')
  const [adjustment, setAdjustment] = useState<{ month: PayrollMonth; noteType: 1 | 2 } | null>(null)
  const listRequest = useRef(0)
  const [monthlyBusy, setMonthlyBusy] = useState(false)
  const [employeeAction, setEmployeeAction] = useState<{
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
    : `${year}-${month || localDate().slice(5, 7)}`
  useJarvisBackAction(
    () => {
      if (busy || monthlyBusy) return
      if (reviewMonth) setReviewMonth(null)
      else {
        setDetailPeriod(null)
        setSearch('')
        setStatus('')
        setSelected([])
        setPage(1)
      }
    },
    Boolean(reviewMonth || (detailPeriod && (isSummaryView || params.get('view') === 'novelties' || params.has('employee')))),
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
    const request = ++listRequest.current
    const list = await payrollService.list()
    if (request !== listRequest.current) return
    setDocuments(list)
    setLoaded(true)
    setSelected([])
    setLoadError('')
  }, [])
  const refreshAfterNovelty = async () => {
    try { await reload() }
    catch { setLoadError('La novedad quedó guardada, pero no se pudo actualizar el listado. Pulsa Reintentar para actualizar los totales.') }
  }
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
  const dateDocuments = annualDocuments.filter(document =>
    isSummaryView || !month || document.state.startDate.slice(5, 7) === month)
  const statusScope = dateDocuments.filter(document => !isSummaryView ||
    (detailPeriod!.includes('|') ? payrollPeriodKey(document) === detailPeriod : document.state.period === detailPeriod))
  const statusOptions = payrollListStatusOptions(filterPayrollList(statusScope, search, ''))
  const effectiveStatus = statusOptions.some(option => option.value === status) ? status : ''
  const matchingDocuments = filterPayrollList(dateDocuments, search, effectiveStatus)
  const allMonths = groupPayrollMonths(annualDocuments)
  const matchingIds = new Set(matchingDocuments.map(document => document.id))
  const months = allMonths.filter(month => month.documents.some(document => matchingIds.has(document.id)))
  const filtered = matchingDocuments
  const visible = filtered.filter(
    (d) =>
      !detailPeriod ||
      (detailPeriod.includes('|')
        ? payrollPeriodKey(d) === detailPeriod
        : d.state.period === detailPeriod),
  )
  const totalRows = isSummaryView ? visible.length : months.length
  const pageCount = Math.max(1, Math.ceil(totalRows / pageSize))
  const currentPage = Math.min(page, pageCount)
  const monthRows = months.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  )
  const rows = visible.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  )
  const deleteFromPeriod = (key: string) => {
    const candidates = annualDocuments.filter(document =>
      payrollPeriodKey(document) === key && document.canDelete)
    if (candidates.length === 1) setDeleteTarget(candidates[0])
    else if (candidates.length > 1) setEmployeeAction({ documents: candidates })
  }
  const exportExcel = (items = isSummaryView ? visible : matchingDocuments) => {
    exportPayrollSummary(items, year)
  }
  const documentActions = (document: PayrollDocument) => [
    ...(!document.originalId
      ? [{ label: 'Duplicar', onClick: () => {} }]
      : []),
    ...(['DRAFT', 'REJECTED'].includes(document.status)
      ? [{ label: 'Editar', onClick: () => {} }]
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
    ...(document.status === 'ACCEPTED'
      ? [
          {
            label: 'Nota de reemplazo',
            onClick: () => {},
          },
          {
            label: 'Nota de eliminación',
            onClick: () => {},
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
  const manageNovelties = (key: string, document?: PayrollDocument) => {
    setNoveltyDocumentId(document?.id ?? null)
    setNoveltyPeriod(key)
  }
  const openPayslip = async (document: PayrollDocument) => {
    const company = user?.company
    if (!company) throw new Error('Selecciona una empresa para generar el desprendible.')
    try {
      await openPayrollPayslipPdf(async () => {
        const [detail, renderer] = await Promise.all([
          payrollService.get(document.id),
          import('./PayrollPayslipPdf'),
        ])
        return renderer.generatePayrollPayslip({ detail, company,
          position: data.positions.find(position => position.id === detail.employee_snapshot.positionId)?.name })
      })
    } catch (error) {
      throw new Error(getApiErrorMessage(error, 'No se pudo generar el desprendible. Intenta nuevamente.'), { cause: error })
    }
  }
  const bulk = async () => {
    setConfirmBulk(false)
    setStatus('')
    const failures: Record<string, string[]> = {}
    await run(async () => {
      try {
        for (const id of selected) {
          const d = documents.find((v) => v.id === id)!
          setSendingName(employeeName(d.employee))
          try {
            const result = await payrollService.send(id)
            const last = result.transmissions[0]
            const messages = payrollSubmissionErrors([last?.error, last?.validation, last?.response])
            const failed = ['REJECTED', 'UNCERTAIN'].includes(result.status)
            if (failed) failures[id] = messages.length ? messages : ['No se confirmó la aceptación. Revisa el resultado antes de reenviar.']
            setDocuments(items => items.map(item => item.id === id ? {
              ...item, status: result.status, submissionErrors: failed ? failures[id] : [],
            } : item))
          } catch (error) {
            failures[id] = [getApiErrorMessage(error, 'No se pudo completar el envío. Revisa el resultado antes de reintentar.')]
            try {
              const result = await payrollService.get(id)
              const last = result.transmissions[0]
              const messages = payrollSubmissionErrors([last?.error, last?.validation, last?.response])
              setDocuments(items => items.map(item => item.id === id ? {
                ...item, status: result.status,
                submissionErrors: result.status === 'ACCEPTED' ? [] : messages.length ? messages : failures[id],
              } : item))
              if (result.status === 'ACCEPTED') delete failures[id]
            } catch {
              setDocuments(items => items.map(item => item.id === id ? { ...item, submissionErrors: failures[id] } : item))
            }
          }
        }
      } finally {
        setSendingName('')
      }
      await reload()
      setDocuments(items => items.map(item => ({ ...item,
        submissionErrors: item.submissionErrors?.length ? item.submissionErrors : failures[item.id] ?? item.submissionErrors,
      })))
    }, '')
  }
  const monthlyReview = allMonths.find(month => month.key === reviewMonth)
  if (monthlyReview) return (
    <div className="payroll__documents"><PayrollHeading title="Revisar nómina del mes" description="Revisa el acumulado de cada empleado antes del envío mensual." /><PayrollMonthlyReview key={monthlyReview.key} month={monthlyReview} concepts={data.parameters.flatMap(parameter => parameter.data.concepts)} onBack={() => setReviewMonth(null)} onReload={reload} onBusyChange={setMonthlyBusy}
      onEditEmployee={id => navigate(`/nomina/empleados?edit=${encodeURIComponent(id)}`)} /></div>
  )
  if (detailPeriod && params.get('view') === 'novelties') {
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
        onFinish={() => {
          setReviewMonth(detailPeriod.slice(0, 7))
          setDetailPeriod(null)
          navigate(`/nomina?year=${year}`, { replace: true })
        }}
        onOpenDocument={() => {}}
      />
    )
  }
  return (
    <div className="payroll__documents">
      {duplicateError && <p className="payroll__notice payroll__notice--error" role="alert">{duplicateError}</p>}
      <PayrollHeading
        title={
          isSummaryView
              ? 'Resumen de nómina'
              : 'Nóminas'
        }
        description={
          isSummaryView
              ? 'Revisa los valores del período antes de enviar la nómina.'
              : 'Guarda tus quincenas y revisa la nómina mensual de cada empleado.'
        }
        actions={
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
        }
      />
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
            {sendingName && <p className="payroll__notice" role="status">Enviando la nómina de {sendingName}… Cada resultado aparecerá junto al empleado.</p>}
            <div className="payroll__card payroll-register__filter-card">
              <div className={`payroll__filters payroll__period-filters${isSummaryView ? "" : " payroll-register__date-filters"}`}>
                <label className="payroll__period-search">
                  <span className="payroll__sr-only">
                    Buscar empleado o identificación
                  </span>
                  <span className="payroll__search-control">
                    <SearchIcon />
                    <input
                      placeholder="Buscar empleado o identificación"
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
                {!isSummaryView && (
                  <>
                    <Field label="Mes">
                      <select aria-label="Mes de nómina" value={month} disabled={busy}
                        onChange={event => {
                          setMonth(event.target.value)
                          setPage(1)
                          setSelected([])
                          setStatus('')
                        }}>
                        <option value="">Todos los meses</option>
                        {Array.from({ length: 12 }, (_, index) => {
                          const value = String(index + 1).padStart(2, '0')
                          const label = new Intl.DateTimeFormat('es-CO', { month: 'long' })
                            .format(new Date(2026, index, 1))
                          return <option key={value} value={value}>{label.charAt(0).toUpperCase() + label.slice(1)}</option>
                        })}
                      </select>
                    </Field>
                    <Field label="Año">
                      <select aria-label="Año de nómina" value={year} disabled={busy}
                        onChange={event => {
                          setYear(event.target.value)
                          setPage(1)
                          setDetailPeriod(null)
                          setSelected([])
                          setStatus('')
                        }}>
                        {years.map(value => <option key={value} value={value}>{value}</option>)}
                      </select>
                    </Field>
                  </>
                )}
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
                    setMonth('')
                    if (!isSummaryView) setYear(localDate().slice(0, 4))
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
                  selectable={false}
                  documents={rows}
                  selected={selected}
                  busy={busy}
                  onSelection={setSelected}
                  onOpen={() => {}}
                  actions={documentActions}
                />
              </div>
            ) : (
              <div className="payroll-register__periods">
                {(month || search || effectiveStatus) && <p className="payroll__muted">Se muestran los meses que coinciden con los filtros, con todos sus períodos para conservar el acumulado completo.</p>}
                {months.length > 0 && <PayrollRegistersTable months={monthRows} busy={busy} initialMonthKey={detailPeriod?.slice(0, 7)}
                  onReview={setReviewMonth} onAdjustment={(month, noteType) => setAdjustment({ month, noteType })} onNovelties={manageNovelties} onExport={exportExcel}
                  onPayslip={openPayslip}
                  onOpen={() => {}} documentActions={documentActions}
                  periodActions={(group, items) => [
                    { label: 'Duplicar', onClick: () => {
                      if (hasUnsavedPayrollNovelties(items.map(document => document.id))) {
                        setDuplicateError('Guarda las novedades pendientes de este período antes de duplicarlo.')
                        return
                      }
                      setDuplicateError('')
                      navigate(`/nomina/nueva?duplicar=${encodeURIComponent(items[0].id)}`)
                    } },
                    ...(group.status === 'ACCEPTED'
                      ? [{ label: 'Exportar Excel', onClick: () => exportExcel(items) },
                        { label: 'Desprendibles', onClick: () => setPayslipDocuments(items) }] : []),
                    ...(items.some(document => ['DRAFT', 'REJECTED'].includes(document.status))
                      ? [{ label: 'Editar', onClick: () => {} }] : []),
                    ...(items.some(document => document.canDelete)
                      ? [{ label: 'Eliminar', danger: true, onClick: () => deleteFromPeriod(group.key) }] : []),
                  ]} />}
                {!months.length && (
                  <div className="payroll__card payroll__empty">
                    <h2>No hay nóminas para mostrar</h2>
                    <p>Prueba con otro mes o año, o limpia los filtros.</p>
                  </div>
                )}
              </div>
            )}
            {shouldShowTablePagination(totalRows, pageSize) && (
              <nav
                className="payroll__pagination payroll-register__pagination"
                aria-label={
                  isSummaryView ? 'Páginas de empleados' : 'Páginas de meses'
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
      </>
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
      {payslipDocuments && <PayrollPayslipsModal documents={payslipDocuments} onClose={() => setPayslipDocuments(null)} />}
      {adjustment && <PayrollAdjustmentModal month={adjustment.month} noteType={adjustment.noteType}
        concepts={[...data.parameters].sort((a, b) => b.validFrom.localeCompare(a.validFrom)).find(parameter => parameter.validFrom <= localDate())?.data.concepts ?? []} onReload={reload}
        onBusyChange={setMonthlyBusy} onClose={() => { if (!monthlyBusy) setAdjustment(null) }} />}
      {employeeAction && (
        <Modal
          title="Eliminar nómina de un empleado"
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
                  setEmployeeAction(null)
                  setDeleteTarget(document)
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
      {noveltyPeriod && <PayrollPeriodNoveltiesModal key={noveltyPeriod} context={context}
        documents={annualDocuments.filter(document => payrollPeriodKey(document) === noveltyPeriod && (!noveltyDocumentId || document.id === noveltyDocumentId))}
        onReload={refreshAfterNovelty} onClose={() => { if (!busy) setNoveltyPeriod(null) }} />}
      {confirmBulk && (
        <Modal
          title="Confirmar envío masivo"
          onClose={() => setConfirmBulk(false)}
        >
          <p>
            Se enviarán {selected.length} nóminas individualmente en ambiente de{' '}
            {data.settings.environment === 1 ? 'producción' : 'pruebas'}. Los
            errores de validación se mostrarán al recibir el resultado del envío.
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
    </div>
  )
}
