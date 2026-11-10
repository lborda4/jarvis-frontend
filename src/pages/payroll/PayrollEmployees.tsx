import { useCallback, useEffect, useRef, useState } from 'react'
import { payrollService, type Employee, type PayrollWorkerCatalogs } from '../../services/payrollService'
import {
  blankEmployee,
  defaultPayrollDocumentType,
  contractLabels,
  currency,
  employeeName,
} from './payrollDefaults'
import { Field, PayrollHeading, type PayrollContext } from './PayrollPage'
import PayrollImport from './PayrollImport'
import usePayrollCatalogs from './usePayrollCatalogs'
import PayrollMoneyInput from './PayrollMoneyInput'
import PayrollPaymentMethodSelect from './PayrollPaymentMethodSelect'
import { employeeBankFields, employeePaymentType } from './employeePayment'
import { canSavePayrollEmployee } from './employeeFormValidity'
import Autocomplete from '../../components/Autocomplete'
import CategorySelect from '../../components/CategorySelect'
import DatePicker from '../../components/DatePicker'
import { SearchIcon } from '../../components/icons/SidebarIcons'
import { lookupJarvisTerceroByNit } from '../../services/jarvisService'
import { applyEmployeeLookup, employeeDetailsFromLookup } from './employeeLookup'
import { useJarvisBackAction } from '../../hooks/useJarvisBackAction'
import { isPayrollEmployeeActive } from '../../utils/payrollEmployeeStatus'
import type { LookupJarvisTerceroNitResponse } from '../../types/jarvis'
import { formatMunicipalityLabel, isMunicipalityMatch } from '../../utils/jarvisMunicipality'
export default function PayrollEmployees({ data, run, busy }: PayrollContext) {
  const [editing, setEditing] = useState<Employee | null>(null),
    [search, setSearch] = useState(''),
    [importing, setImporting] = useState(false)
  const applyCatalogDefaults = useCallback((value: PayrollWorkerCatalogs) => {
    const documentTypeId = defaultPayrollDocumentType(value.identifications)
    if (documentTypeId) setEditing(current => current && !current.documentTypeId ? { ...current, documentTypeId } : current)
  }, [])
  const {
    catalogs,
    error: catalogError,
    reload: reloadCatalogs,
    municipalities, municipalitiesError, municipalitiesLoading, reloadMunicipalities,
  } = usePayrollCatalogs(Boolean(editing), applyCatalogDefaults)
  const lookupRequest = useRef(0)
  const lookupInFlight = useRef<string | null>(null)
  const [lookup, setLookup] = useState<{ key: string; message: string; pending: boolean } | null>(null)
  const [lookupResult, setLookupResult] = useState<{ request: number; employee: Employee; result: LookupJarvisTerceroNitResponse } | null>(null)
  useEffect(() => {
    if (!lookupResult || lookupResult.request !== lookupRequest.current) return
    const details = employeeDetailsFromLookup(lookupResult.result, municipalities)
    // La respuesta y el catálogo llegan por separado; completar la ciudad cuando ambos estén disponibles.
    setEditing(current => current ? applyEmployeeLookup(current, lookupResult.employee, details) : current)
  }, [lookupResult, municipalities])
  useJarvisBackAction(() => {
    if (busy) return
    if (importing) setImporting(false)
    else setEditing(null)
  }, Boolean(editing) || importing)
  useEffect(() => () => { lookupRequest.current += 1 }, [])
  const lookupKey = editing ? `${editing.id}:${editing.documentTypeId}:${editing.identification}` : ''
  const isNewEmployee = Boolean(editing && !data.employees.some(employee => employee.id === editing.id))
  const identificationType = catalogs?.identifications?.find(item => item.id === editing?.documentTypeId)
  const lookupSupported = identificationType?.code?.trim().toUpperCase() === 'CC' ||
    /cedula (de )?ciudadania/.test(identificationType?.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() ?? '')
  const lookupPending = lookup?.key === lookupKey && lookup.pending
  const canLookup = isNewEmployee && lookupSupported && /^\d{5,15}$/.test(editing?.identification ?? '') && !busy && !lookupPending
  const paymentType = employeePaymentType(editing?.paymentMethodId ?? 0, catalogs?.paymentMethods)
  const canSave = !busy && !municipalitiesLoading && canSavePayrollEmployee(editing, catalogs, municipalities, data.positions)
  const lookupEmployee = async () => {
    if (!editing || !canLookup || lookupInFlight.current === lookupKey) return
    const employee = editing
    const key = lookupKey
    const request = ++lookupRequest.current
    lookupInFlight.current = key
    setLookup({ key, message: 'Consultando cédula…', pending: true })
    try {
      const result = await lookupJarvisTerceroByNit(employee.identification, 'CC')
      if (request !== lookupRequest.current) return
      const details = employeeDetailsFromLookup(result, municipalities)
      const hasCity = result.found && (result.cityCode || result.cityName || result.municipalityId)
      if (!details.names && !details.email && !details.address && !hasCity) {
        setLookup({ key, message: 'No se encontraron datos para esta cédula. Puedes ingresar la información manualmente.', pending: false })
        return
      }
      setLookupResult({ request, employee, result })
      setEditing(current => current ? applyEmployeeLookup(current, employee, details) : current)
      const message = details.names
        ? `Nombre encontrado: ${result.name}. Revisa y completa los datos personales y de ubicación antes de guardar.`
        : 'Se encontraron datos para esta cédula. Revisa y completa la información antes de guardar.'
      setLookup({ key, message, pending: false })
    } catch {
      if (request === lookupRequest.current) setLookup({ key, message: 'No pudimos autocompletar los datos. Puedes ingresarlos manualmente o pulsar Autocompletar para intentar de nuevo.', pending: false })
    } finally {
      if (lookupInFlight.current === key) lookupInFlight.current = null
    }
  }
  const update = (key: keyof Employee, value: Employee[keyof Employee]) => {
    if (key === 'identification' || key === 'documentTypeId') {
      lookupRequest.current += 1
      setLookup(null)
      setLookupResult(null)
    }
    setEditing((e) => (e ? { ...e, [key]: value } : e))
  }
  const save = async () => {
    if (canSave && editing && (await run(() => payrollService.employees({ ...editing, typeContractId: catalogs?.contractTypes?.find(contract => contract.key === editing.contractType)?.id, ...(paymentType ? employeeBankFields(editing, paymentType) : {}), email: editing.email?.trim() ?? '', address: editing.address?.trim() ?? '', active: isPayrollEmployeeActive(editing.retirementDate) }))))
      setEditing(null)
  }
  const catalogField = (
    key: 'typeWorkerId' | 'subTypeWorkerId' | 'documentTypeId',
    label: string,
    rows?: { id: number; name: string; code?: string }[],
  ) => (
    <Field label={label}>
      {key === 'typeWorkerId' || key === 'subTypeWorkerId' ? <Autocomplete
        className="account-autocomplete payroll__catalog-select"
        value={rows?.find(row => row.id === editing?.[key]) ?? null}
        options={rows ?? []}
        onChange={option => update(key, option?.id ?? 0)}
        getOptionKey={option => option.id}
        getOptionLabel={option => option.name}
        placeholder={catalogs ? 'Seleccionar o buscar…' : 'Cargando opciones…'}
        emptyMessage="No se encontraron opciones."
        disabled={!catalogs}
        required
        selectOnFocus
      /> : <select
        required
        disabled={!catalogs || !rows?.length}
        value={editing?.[key] || ''}
        onChange={(e) => update(key, Number(e.target.value))}
      >
        <option value="">
          {catalogs ? 'Seleccionar' : 'Cargando opciones…'}
        </option>
        {rows?.map((row) => (
          <option key={row.id} value={row.id}>
            {row.name}
          </option>
        ))}
      </select>}
      {key === 'documentTypeId' && catalogs && !rows?.length && <small role="alert">
        No pudimos cargar los tipos de documento. Inténtalo de nuevo. Si el problema continúa, comunícate con soporte.{' '}
        <button type="button" className="payroll__link" disabled={busy} onClick={() => void reloadCatalogs()}>Reintentar tipos de documento</button>
      </small>}
    </Field>
  )
  const list = data.employees.map(employee => ({ ...employee, active: isPayrollEmployeeActive(employee.retirementDate) })).filter((e) =>
    `${e.workerCode ?? ''} ${employeeName(e)} ${e.identification}`
      .toLocaleLowerCase()
      .includes(search.toLocaleLowerCase()),
  )
  return (
    <>
      <PayrollHeading
        title="Empleados"
        description="Administra los trabajadores registrados para la generación de nómina electrónica."
        actions={
          <>
            <button
              className="payroll__button"
              onClick={() => setImporting(true)}
            >
              Importar Excel
            </button>
            <button
              className="payroll__button payroll__button--primary"
              disabled={busy}
              onClick={() =>
                setEditing({
                  ...blankEmployee(catalogs?.identifications),
                  paymentMethodId:
                    data.parameters[0]?.data.paymentMethodId ?? 0,
                  jarvisPaymentMethodId: data.parameters[0]?.data.jarvisPaymentMethodId,
                  paymentMethodName: data.parameters[0]?.data.paymentMethodName,
                })
              }
            >
              + Nuevo empleado
            </button>
          </>
        }
      />
      {editing && catalogError && (
        <div role="alert" className="payroll__notice payroll__notice--error">
          {catalogError}{' '}
          <button
            className="payroll__link"
            onClick={() => void reloadCatalogs()}
          >
            Reintentar
          </button>
        </div>
      )}
      {editing ? (
        <form onSubmit={(event) => event.preventDefault()}>
          <details className="payroll__card" open>
            <summary>Información personal</summary>
            <div className="payroll__section payroll__grid">
              {catalogField(
                'documentTypeId',
                'Tipo de documento',
                catalogs?.identifications,
              )}
              <Field label="Identificación">
                <div className="payroll__identification-control">
                <input
                  aria-label="Identificación"
                  required
                  pattern="[0-9]{5,20}"
                  value={editing.identification}
                  onChange={(e) => update('identification', e.target.value)}
                />
                {isNewEmployee && <button
                  type="button"
                  className="payroll__autofill-button"
                  disabled={!canLookup}
                  aria-busy={lookupPending || undefined}
                  onClick={() => void lookupEmployee()}
                  title={lookupSupported ? 'Buscar y completar los datos disponibles de esta cédula' : 'Disponible para cédula de ciudadanía'}
                >
                  <SearchIcon />
                  <span>{lookupPending ? 'Consultando…' : 'Autocompletar'}</span>
                </button>}
                </div>
                {lookup?.key === lookupKey && <small role="status" aria-live="polite">{lookup.message}</small>}
              </Field>
              {(
                ['firstName', 'secondName', 'surname', 'secondSurname'] as const
              ).map((key, i) => (
                <Field
                  key={key}
                  label={
                    [
                      'Primer nombre',
                      'Segundo nombre',
                      'Primer apellido',
                      'Segundo apellido',
                    ][i]
                  }
                >
                  <input
                    required={key === 'firstName' || key === 'surname'}
                    value={editing[key]}
                    onChange={(e) => update(key, e.target.value)}
                  />
                </Field>
              ))}
              <Field label="Correo electrónico">
                <input
                  type="email"
                  maxLength={254}
                  autoComplete="email"
                  value={editing.email ?? ''}
                  onChange={(e) => update('email', e.target.value)}
                  onBlur={(e) => update('email', e.target.value.trim())}
                  placeholder="empleado@correo.com"
                />
              </Field>
              <Field label="Dirección">
                <input
                  required
                  autoComplete="street-address"
                  value={editing.address ?? ''}
                  onChange={event => update('address', event.target.value)}
                  onBlur={event => update('address', event.target.value.trim())}
                  placeholder="Calle, carrera, número y complemento"
                />
              </Field>
              <Field label="Ciudad">
                <Autocomplete
                  value={municipalities.find(city => city.id === editing.municipalityId) ?? null}
                  onChange={city => update('municipalityId', city?.id ?? 0)}
                  options={municipalities}
                  required
                  disabled={municipalitiesLoading || busy}
                  placeholder={municipalitiesLoading ? 'Cargando ciudades…' : 'Buscar ciudad'}
                  emptyMessage="No se encontraron ciudades."
                  clearLabel="Quitar ciudad"
                  getOptionKey={city => city.id}
                  getOptionLabel={formatMunicipalityLabel}
                  isOptionMatch={isMunicipalityMatch}
                />
                {municipalitiesError && <small role="alert">{municipalitiesError} <button type="button" className="payroll__link" onClick={reloadMunicipalities}>Reintentar ciudades</button></small>}
              </Field>
            </div>
          </details>
          <details className="payroll__card" open>
            <summary>Información laboral</summary>
            <div className="payroll__section payroll__grid">
              {catalogField(
                'typeWorkerId',
                'Tipo de trabajador',
                catalogs?.workerTypes,
              )}
              {catalogField(
                'subTypeWorkerId',
                'Subtipo de trabajador',
                catalogs?.workerSubtypes,
              )}
              <Field label="Tipo de contrato">
                <select
                  required
                  disabled={!catalogs || busy}
                  value={catalogs?.contractTypes?.some(contract => contract.key === editing.contractType) ? editing.contractType : ''}
                  onChange={event => setEditing(current => current ? { ...current, contractType: event.target.value, typeContractId: catalogs?.contractTypes?.find(contract => contract.key === event.target.value)?.id } : current)}
                >
                  <option value="">{!catalogs ? 'Cargando contratos…' : 'Seleccionar contrato'}</option>
                  {catalogs?.contractTypes?.map(contract => (
                    <option key={contract.key} value={contract.key}>
                      {contract.name}
                    </option>
                  ))}
                </select>
                {catalogs && !catalogs.contractTypes?.length && <small role="alert">No pudimos cargar los tipos de contrato. Inténtalo de nuevo. Si el problema continúa, comunícate con soporte. <button type="button" className="payroll__link" onClick={() => void reloadCatalogs()}>Reintentar contratos</button></small>}
              </Field>
              <Field label="Cargo (opcional)">
                <CategorySelect
                  value={editing.positionId}
                  categories={data.positions.filter(position => position.active || position.id === editing.positionId)}
                  itemLabel="cargo"
                  placeholder="Seleccionar cargo"
                  disabled={busy}
                  onChange={id => update('positionId', id)}
                  onEdit={async (id, name) => {
                    const position = data.positions.find(item => item.id === id)
                    if (!position) throw new Error('No se encontró el cargo.')
                    if (name.trim().length > 150) throw new Error('El cargo puede tener máximo 150 caracteres.')
                    const saved = await run(() => payrollService.position({ ...position, name: name.trim() }), 'Cargo actualizado.')
                    if (!saved) throw new Error('No se pudo actualizar el cargo. Intenta nuevamente.')
                    return { id, name: name.trim() }
                  }}
                  onDelete={async id => {
                    const deleted = await run(() => payrollService.deletePosition(id), 'Cargo eliminado de las opciones disponibles.')
                    if (!deleted) throw new Error('No se pudo eliminar el cargo. Intenta nuevamente.')
                  }}
                  deleteDescription="Dejará de aparecer para nuevas asignaciones. Los empleados ya guardados conservarán su cargo."
                  onCreate={async name => {
                    if (name.trim().length > 150) throw new Error('El cargo puede tener máximo 150 caracteres.')
                    const id = crypto.randomUUID()
                    const saved = await run(() => payrollService.position({
                      id,
                      code: id.replaceAll('-', '').slice(0, 30),
                      name: name.trim(),
                      salary: editing.salary,
                      active: true,
                    }), '')
                    if (!saved) throw new Error('No se pudo crear el cargo. Intenta nuevamente.')
                    return { id, name: name.trim() }
                  }}
                />
              </Field>
              <Field label="Fecha de ingreso">
                <DatePicker
                  className="payroll__employee-date"
                  placeholder="Seleccionar fecha"
                  monthYearNavigation
                  disabled={busy}
                  value={editing.admittanceDate}
                  onChange={value => update('admittanceDate', value)}
                />
              </Field>
              <Field label="Fecha de retiro (opcional)">
                <input
                  type="date"
                  min={editing.admittanceDate}
                  value={editing.retirementDate}
                  onChange={(e) => update('retirementDate', e.target.value)}
                />
              </Field>
              <Field
                label={
                  editing.contractType === 'APPRENTICE'
                    ? 'Apoyo de sostenimiento'
                    : 'Salario básico'
                }
              >
                <PayrollMoneyInput
                  required
                  min="0"
                  step="0.01"
                  value={editing.salary}
                  onValueChange={value => update('salary', value)}
                />
              </Field>
              <label className="payroll__check">
                <input
                  type="checkbox"
                  checked={editing.integralSalary}
                  onChange={event => update('integralSalary', event.target.checked)}
                />
                Salario integral
              </label>
              <Field label="Método de pago"><PayrollPaymentMethodSelect required value={editing.paymentMethodId} savedId={editing.jarvisPaymentMethodId} savedName={editing.paymentMethodName} onChange={method => setEditing({ ...editing, paymentMethodId: method?.nextpymeMethodId ?? 0, jarvisPaymentMethodId: method?.id, paymentMethodName: method?.name })} /></Field>
              {paymentType === 'transfer' && <>
                <Field label="Nombre del banco">
                  <input required name="bank_name" autoComplete="off" value={editing.bankName ?? ''}
                    onChange={event => update('bankName', event.target.value)}
                    onBlur={event => update('bankName', event.target.value.trim())} />
                </Field>
                <Field label="Tipo de cuenta">
                  <select required name="account_type" value={editing.accountType ?? ''} onChange={event => update('accountType', event.target.value)}>
                    <option value="">Seleccionar</option><option value="AHORROS">AHORROS</option><option value="CORRIENTE">CORRIENTE</option>
                  </select>
                </Field>
                <Field label="Número de cuenta">
                  <input required name="account_number" type="text" inputMode="numeric" pattern="[0-9]+" autoComplete="off"
                    title="Ingresa únicamente números." value={editing.accountNumber ?? ''}
                    onChange={event => update('accountNumber', event.target.value.trim())} />
                </Field>
              </>}
            </div>
            {editing.contractType === 'APPRENTICE' && (
              <div className="payroll__section">
                <p className="payroll__muted">
                  Las sugerencias de descuentos requieren reglas verificadas
                  para la modalidad, etapa y vigencia. Puedes ingresar los
                  valores previamente liquidados.
                </p>
                <div className="payroll__grid">
                  <Field label="Modalidad">
                    <select
                      value={editing.apprenticeMode}
                      onChange={(e) => update('apprenticeMode', e.target.value)}
                    >
                      <option value="TRADITIONAL">Tradicional</option>
                      <option value="DUAL">Dual</option>
                    </select>
                  </Field>
                  <Field label="Etapa">
                    <select
                      value={editing.apprenticeStage}
                      onChange={(e) =>
                        update('apprenticeStage', e.target.value)
                      }
                    >
                      <option value="LECTIVE">Lectiva</option>
                      <option value="PRACTICAL">Práctica</option>
                    </select>
                  </Field>
                  <label className="payroll__check">
                    <input
                      type="checkbox"
                      checked={editing.universityStudent}
                      onChange={(e) =>
                        update('universityStudent', e.target.checked)
                      }
                    />
                    Estudiante universitario
                  </label>
                  <Field label="Inicio de etapa">
                    <input
                      type="date"
                      value={editing.stageStart}
                      onChange={(e) => update('stageStart', e.target.value)}
                    />
                  </Field>
                  <Field label="Final de etapa">
                    <input
                      type="date"
                      value={editing.stageEnd}
                      onChange={(e) => update('stageEnd', e.target.value)}
                    />
                  </Field>
                </div>
              </div>
            )}
          </details>
          <div className="payroll__toolbar">
            <button
              type="button"
              className="payroll__button"
              onClick={() => setEditing(null)}
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={!canSave}
              className="payroll__button payroll__button--primary"
              onClick={(event) => {
                if (event.currentTarget.form?.reportValidity()) void save()
              }}
            >
              Guardar empleado
            </button>
          </div>
        </form>
      ) : (
        <div className="payroll__card">
          <div className="payroll__filters">
            <Field label="Buscar empleado">
              <input
                placeholder="Código, nombre o identificación"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </Field>
          </div>
          <div className="payroll__scroll">
            <table>
              <thead>
                <tr>
                  {[
                    'Código',
                    'Identificación',
                    'Nombre',
                    'Cargo',
                    'Tipo de contrato',
                    'Salario',
                    'Estado',
                    'Acciones',
                  ].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map((e) => (
                  <tr key={e.id}>
                    <td>{e.workerCode || '—'}</td>
                    <td>{e.identification}</td>
                    <td>{employeeName(e)}</td>
                    <td>
                      {data.positions.find((p) => p.id === e.positionId)
                        ?.name ?? '—'}
                    </td>
                    <td>{contractLabels[e.contractType]}</td>
                    <td>{currency(e.salary)}</td>
                    <td>
                      <span
                        className={`payroll__badge ${e.active ? 'payroll__badge--ACCEPTED' : ''}`}
                      >
                        {e.active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="payroll__actions">
                      <button
                        className="payroll__link"
                        onClick={() => setEditing({ ...e })}
                      >
                        Editar
                      </button>
                      <a
                        className="payroll__link"
                        href={`/nomina?employee=${e.id}`}
                      >
                        Historial
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!list.length && (
            <div className="payroll__empty">
              No hay empleados para mostrar. Registra el primero para preparar
              su nómina.
            </div>
          )}
        </div>
      )}
      {importing && (
        <PayrollImport
          kind="employees"
          data={data}
          run={run}
          busy={busy}
          onClose={() => setImporting(false)}
        />
      )}
    </>
  )
}
