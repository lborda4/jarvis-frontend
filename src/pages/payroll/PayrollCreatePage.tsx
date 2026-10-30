import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  payrollService,
  type PayrollDocument,
} from '../../services/payrollService'
import {
  SearchIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '../../components/icons/SidebarIcons'
import { shouldShowTablePagination } from '../../utils/tablePagination'
import {
  PAYROLL_PERIODICITY_LABELS,
  payrollPeriodBounds,
  validatePayrollPeriod,
  type PayrollPeriodicity,
} from '../../utils/payrollPeriod'
import { contractLabels, employeeName, localDate } from './payrollDefaults'
import { PayrollHeading, type PayrollContext } from './PayrollPage'
import { ensurePayrollParameters } from './ensurePayrollParameters'
import { payrollEmploymentDays } from '../../utils/payrollEmployment'

const pageSize = 10
function RequiredField({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label>
      <span>
        {label}{' '}
        <span className="payroll__required" aria-hidden="true">
          *
        </span>
      </span>
      {children}
    </label>
  )
}
export default function PayrollCreatePage({ data, run, busy }: PayrollContext) {
  const navigate = useNavigate(),
    [params] = useSearchParams()
  const initial = /^\d{4}-(0[1-9]|1[0-2])$/.test(params.get('period') ?? '')
    ? params.get('period')!
    : localDate().slice(0, 7)
  const [name, setName] = useState(''),
    [periodicity, setPeriodicity] = useState<PayrollPeriodicity | ''>(''),
    [month, setMonth] = useState(initial.slice(5, 7)),
    [year, setYear] = useState(initial.slice(0, 4)),
    [search, setSearch] = useState(''),
    [selected, setSelected] = useState<string[]>([]),
    [page, setPage] = useState(1)
  const [sort, setSort] = useState<'name' | 'identification'>('name'),
    [descending, setDescending] = useState(false)
  const [documents, setDocuments] = useState<PayrollDocument[]>([]),
    [loaded, setLoaded] = useState(false),
    [loadError, setLoadError] = useState(''),
    [errors, setErrors] = useState<string[]>([])
  const [groupId] = useState(() => crypto.randomUUID())
  const submitting = useRef(false),
    selectAll = useRef<HTMLInputElement>(null)
  useEffect(() => {
    let active = true
    void payrollService
      .list()
      .then((result) => {
        if (active) {
          setDocuments(result)
          setLoaded(true)
        }
      })
      .catch(() => {
        if (active)
          setLoadError(
            'No se pudo consultar qué empleados ya están incluidos en nóminas. Intenta de nuevo.',
          )
      })
    return () => {
      active = false
    }
  }, [])
  const reloadDocuments = async () => {
    setLoadError('')
    try {
      setDocuments(await payrollService.list())
      setLoaded(true)
    } catch {
      setLoadError('No se pudieron consultar las nóminas existentes.')
    }
  }
  const period = `${year}-${month}`
  let bounds: { startDate: string; endDate: string } | null = null
  try {
    if (periodicity) bounds = payrollPeriodBounds(period, periodicity)
  } catch {
    /* incomplete form */
  }
  const parameters = bounds
    ? data.parameters.find((p) => p.validFrom <= bounds!.startDate)?.data
    : undefined
  const availability = (id: string) => {
    const employee = data.employees.find((e) => e.id === id)!
    if (!employee.active) return 'Inactivo'
    if (!bounds) return 'Disponible'
    if (payrollEmploymentDays(bounds, employee).days <= 0)
      return employee.admittanceDate > bounds.endDate
        ? 'Ingreso posterior al fin del período'
        : 'Retiro anterior al inicio del período'
    if (
      documents.some(
        (d) =>
          d.employeeId === id &&
          !d.originalId &&
          d.state.startDate === bounds.startDate &&
          d.state.endDate === bounds.endDate,
      )
    )
      return 'Ya incluido en este período'
    return 'Disponible'
  }
  const eligibleIds = data.employees
    .filter((e) => availability(e.id) === 'Disponible')
    .map((e) => e.id)
  const chosen = selected.filter((id) => eligibleIds.includes(id))
  const filtered = data.employees
    .filter((e) =>
      `${employeeName(e)} ${e.identification}`
        .toLocaleLowerCase('es')
        .includes(search.toLocaleLowerCase('es')),
    )
    .sort((a, b) => {
      const result = (
        sort === 'name' ? employeeName(a) : a.identification
      ).localeCompare(
        sort === 'name' ? employeeName(b) : b.identification,
        'es',
        { numeric: true, sensitivity: 'base' },
      )
      return descending ? -result : result
    })
  const filteredEligible = filtered
    .filter((e) => eligibleIds.includes(e.id))
    .map((e) => e.id)
  const allSelected =
    filteredEligible.length > 0 &&
    filteredEligible.every((id) => chosen.includes(id))
  useEffect(() => {
    if (selectAll.current)
      selectAll.current.indeterminate =
        !allSelected && filteredEligible.some((id) => chosen.includes(id))
  }, [allSelected, filteredEligible, chosen])
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize)),
    currentPage = Math.min(page, pages),
    rows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const years = [
    ...new Set([
      Number(year),
      ...Array.from(
        { length: 8 },
        (_, i) => Number(localDate().slice(0, 4)) + 1 - i,
      ),
    ]),
  ].sort((a, b) => b - a)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (submitting.current || busy) return
    const request = {
      name,
      period,
      periodicity: periodicity as PayrollPeriodicity,
      employeeIds: chosen,
    }
    const issues = validatePayrollPeriod(request)
    if (!loaded)
      issues.push('Espera a que se consulten las nóminas existentes.')
    setErrors(issues)
    if (issues.length) return
    submitting.current = true
    try {
      let key = ''
      const ok = await run(async () => {
        if (!parameters && bounds) await ensurePayrollParameters(bounds.startDate)
        const result = await payrollService.createPeriod(groupId, request)
        key = result.key
      }, 'Nómina creada. Puedes revisar y modificar los valores de cada empleado.')
      if (ok)
        navigate(`/nomina?period=${encodeURIComponent(key)}&year=${year}`, {
          replace: true,
        })
    } finally {
      submitting.current = false
    }
  }
  const sortBy = (key: typeof sort) => {
    if (sort === key) setDescending(!descending)
    else {
      setSort(key)
      setDescending(false)
    }
    setPage(1)
  }
  return (
    <>
      <PayrollHeading
        title="Nueva nómina"
        description="Selecciona el período y los empleados que formarán parte de la nómina."
        actions={
          <>
            <button
              type="button"
              disabled={busy}
              className="payroll__button"
              onClick={() => navigate('/nomina')}
            >
              Regresar
            </button>
            <button
              type="submit"
              form="create-payroll-period"
              disabled={busy || !loaded}
              className="payroll__button payroll__button--primary"
            >
              {busy ? 'Creando…' : 'Crear nómina'}
            </button>
          </>
        }
      />
      <p className="payroll__muted">
        Todos los campos marcados con{' '}
        <span className="payroll__required">*</span> son obligatorios.
      </p>
      <form id="create-payroll-period" onSubmit={(e) => void submit(e)}>
        <section className="payroll__card payroll__section payroll__create-general">
          <h2>Información general</h2>
          <div className="payroll__create-fields">
            <RequiredField label="Periodicidad">
              <select
                required
                value={periodicity}
                onChange={(e) => {
                  setPeriodicity(e.target.value as PayrollPeriodicity)
                }}
              >
                <option value="">Seleccionar periodicidad</option>
                {Object.entries(PAYROLL_PERIODICITY_LABELS).map(
                  ([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ),
                )}
              </select>
            </RequiredField>
            <RequiredField label="Nombre de la nómina">
              <input
                required
                maxLength={150}
                value={name}
                placeholder="Ej. Nómina de administración"
                onChange={(e) => setName(e.target.value)}
              />
            </RequiredField>
            <RequiredField label="Mes">
              <select
                required
                value={month}
                onChange={(e) => {
                  setMonth(e.target.value)
                }}
              >
                <option value="">Seleccionar mes</option>
                {Array.from({ length: 12 }, (_, index) => {
                  const label = new Intl.DateTimeFormat('es-CO', {
                    month: 'long',
                    timeZone: 'UTC',
                  }).format(new Date(Date.UTC(2026, index, 1)))
                  return (
                    <option
                      key={index}
                      value={String(index + 1).padStart(2, '0')}
                    >
                      {label.charAt(0).toUpperCase() + label.slice(1)}
                    </option>
                  )
                })}
              </select>
            </RequiredField>
            <RequiredField label="Año">
              <select
                required
                value={year}
                onChange={(e) => {
                  setYear(e.target.value)
                }}
              >
                {years.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </RequiredField>
          </div>
          {bounds && (
            <p className="payroll__muted">
              Período: {bounds.startDate.split('-').reverse().join('/')} al{' '}
              {bounds.endDate.split('-').reverse().join('/')}
            </p>
          )}
        </section>
        {loadError && (
          <div role="alert" className="payroll__notice payroll__notice--error">
            {loadError}{' '}
            <button
              type="button"
              className="payroll__link"
              onClick={() => void reloadDocuments()}
            >
              Reintentar
            </button>
          </div>
        )}
        <section className="payroll__card payroll__create-employees">
          <div className="payroll__footer payroll__create-employees-header">
            <div>
              <h2>
                Empleados <span className="payroll__required">*</span>
              </h2>
              <p className="payroll__muted">
                {bounds
                  ? `${eligibleIds.length} empleados disponibles`
                  : 'Selecciona los empleados que incluirás en la nómina'}{' '}
                · <strong>{chosen.length} seleccionados</strong>
              </p>
            </div>
            <label className="payroll__create-search">
              <span className="payroll__sr-only">Buscar empleado</span>
              <span className="payroll__search-control">
                <SearchIcon />
                <input
                  value={search}
                  placeholder="Buscar por nombre o identificación"
                  onChange={(e) => {
                    setSearch(e.target.value)
                    setPage(1)
                  }}
                />
              </span>
            </label>
          </div>
          <div className="payroll__scroll">
            <table>
              <thead>
                <tr>
                  <th className="payroll__checkbox-column">
                    <input
                      ref={selectAll}
                      type="checkbox"
                      aria-label="Seleccionar todos los empleados disponibles de la búsqueda"
                      disabled={!loaded || !filteredEligible.length || busy}
                      checked={allSelected}
                      onChange={(e) =>
                        setSelected(
                          e.target.checked
                            ? [...new Set([...chosen, ...filteredEligible])]
                            : chosen.filter(
                                (id) => !filteredEligible.includes(id),
                              ),
                        )
                      }
                    />
                  </th>
                  <th
                    aria-sort={
                      sort === 'name'
                        ? descending
                          ? 'descending'
                          : 'ascending'
                        : 'none'
                    }
                  >
                    <button
                      type="button"
                      className="payroll__sort"
                      onClick={() => sortBy('name')}
                    >
                      Nombre <span aria-hidden="true">↕</span>
                    </button>
                  </th>
                  <th
                    aria-sort={
                      sort === 'identification'
                        ? descending
                          ? 'descending'
                          : 'ascending'
                        : 'none'
                    }
                  >
                    <button
                      type="button"
                      className="payroll__sort"
                      onClick={() => sortBy('identification')}
                    >
                      Identificación <span aria-hidden="true">↕</span>
                    </button>
                  </th>
                  <th>Cargo</th>
                  <th>Tipo de contrato</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((employee) => {
                  const reason = availability(employee.id),
                    available = reason === 'Disponible'
                  return (
                    <tr
                      key={employee.id}
                      className={
                        chosen.includes(employee.id)
                          ? 'payroll__employee-selected'
                          : undefined
                      }
                    >
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`Incluir a ${employeeName(employee)}`}
                          disabled={!loaded || !available || busy}
                          checked={chosen.includes(employee.id)}
                          onChange={(e) =>
                            setSelected(
                              e.target.checked
                                ? [...chosen, employee.id]
                                : chosen.filter((id) => id !== employee.id),
                            )
                          }
                        />
                      </td>
                      <td>{employeeName(employee)}</td>
                      <td>{employee.identification}</td>
                      <td>
                        {data.positions.find(
                          (p) => p.id === employee.positionId,
                        )?.name ?? '—'}
                      </td>
                      <td>
                        {contractLabels[employee.contractType] ??
                          employee.contractType}
                      </td>
                      <td>
                        <span
                          className={`payroll__badge ${available ? 'payroll__badge--ACCEPTED' : ''}`}
                        >
                          {reason}
                        </span>
                      </td>
                    </tr>
                  )
                })}
                {!filtered.length && (
                  <tr>
                    <td colSpan={6} className="payroll__empty">
                      {data.employees.length ? (
                        'No hay empleados que coincidan con la búsqueda.'
                      ) : (
                        <>
                          Aún no hay empleados registrados.{' '}
                          <Link
                            className="payroll__link"
                            to="/nomina/empleados"
                          >
                            Registrar empleados
                          </Link>
                        </>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="payroll__footer">
            <span>
              {filtered.length} empleados · {chosen.length} seleccionados
            </span>
            {shouldShowTablePagination(filtered.length, pageSize) && (
              <nav
                className="payroll__pagination"
                aria-label="Páginas de empleados"
              >
                <button
                  type="button"
                  className="payroll__button"
                  aria-label="Página anterior"
                  disabled={currentPage === 1}
                  onClick={() => setPage(currentPage - 1)}
                >
                  <ChevronLeftIcon />
                </button>
                <span>
                  {currentPage} / {pages}
                </span>
                <button
                  type="button"
                  className="payroll__button"
                  aria-label="Página siguiente"
                  disabled={currentPage === pages}
                  onClick={() => setPage(currentPage + 1)}
                >
                  <ChevronRightIcon />
                </button>
              </nav>
            )}
          </div>
        </section>
        {!!errors.length && (
          <div role="alert" className="payroll__notice payroll__notice--error">
            <ul>
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        )}
      </form>
    </>
  )
}
