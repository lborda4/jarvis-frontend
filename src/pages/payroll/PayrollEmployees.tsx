import { useEffect, useRef, useState, type FormEvent } from 'react'
import { payrollService, type Employee } from '../../services/payrollService'
import {
  blankEmployee,
  contractLabels,
  currency,
  employeeName,
} from './payrollDefaults'
import { Field, PayrollHeading, type PayrollContext } from './PayrollPage'
import PayrollImport from './PayrollImport'
import usePayrollCatalogs from './usePayrollCatalogs'
import PayrollMoneyInput from './PayrollMoneyInput'
import PayrollPaymentMethodSelect from './PayrollPaymentMethodSelect'
import Autocomplete from '../../components/Autocomplete'
import CategorySelect from '../../components/CategorySelect'
import { lookupJarvisTerceroByNit } from '../../services/jarvisService'
import { employeeNamesFromFullName } from './employeeLookup'
import { useJarvisBackAction } from '../../hooks/useJarvisBackAction'
import { isPayrollEmployeeActive } from '../../utils/payrollEmployeeStatus'
export default function PayrollEmployees({ data, run, busy }: PayrollContext) {
  const {
    catalogs,
    error: catalogError,
    reload: reloadCatalogs,
  } = usePayrollCatalogs()
  const [editing, setEditing] = useState<Employee | null>(null),
    [search, setSearch] = useState(''),
    [importing, setImporting] = useState(false)
  const lookupRequest = useRef(0)
  const [lookup, setLookup] = useState<{ key: string; message: string; pending: boolean } | null>(null)
  useJarvisBackAction(() => {
    if (busy) return
    if (importing) setImporting(false)
    else setEditing(null)
  }, Boolean(editing) || importing)
  useEffect(() => () => { lookupRequest.current += 1 }, [])
  const lookupKey = editing ? `${editing.id}:${editing.documentTypeId}:${editing.identification}` : ''
  const lookupEmployee = async () => {
    if (!editing || data.employees.some(employee => employee.id === editing.id)) return
    const document = catalogs?.identifications?.find(item => item.id === editing.documentTypeId)
    const normalizedType = document?.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() ?? ''
    if (!(document?.code?.toUpperCase() === 'CC' || /cedula (de )?ciudadania/.test(normalizedType))) return
    if (!/^\d{5,15}$/.test(editing.identification)) return
    if (lookup?.key === lookupKey && lookup.pending) return
    const employee = editing
    const key = lookupKey
    const request = ++lookupRequest.current
    setLookup({ key, message: 'Consultando cédula en NextPyme…', pending: true })
    try {
      const result = await lookupJarvisTerceroByNit(employee.identification, 'CC')
      if (request !== lookupRequest.current) return
      const names = result.found && result.name ? employeeNamesFromFullName(result.name) : null
      if (!names) {
        setLookup({ key, message: 'No se encontraron nombres para esta cédula. Puedes ingresarlos manualmente.', pending: false })
        return
      }
      setEditing(current => {
        if (!current || current.id !== employee.id || current.identification !== employee.identification || current.documentTypeId !== employee.documentTypeId) return current
        // No reemplazar nombres que el usuario haya escrito durante la consulta.
        if ((['firstName', 'secondName', 'surname', 'secondSurname'] as const).some(field => current[field] !== employee[field])) return current
        return { ...current, ...names }
      })
      setLookup({ key, message: `Nombre encontrado: ${result.name}. Revisa el orden de los nombres y apellidos antes de guardar.`, pending: false })
    } catch {
      if (request === lookupRequest.current) setLookup({ key, message: 'No se pudo consultar la cédula. Puedes ingresar los nombres manualmente o volver a salir del campo para reintentar.', pending: false })
    }
  }
  const update = (key: keyof Employee, value: Employee[keyof Employee]) => {
    if (key === 'identification' || key === 'documentTypeId') {
      lookupRequest.current += 1
      setLookup(null)
    }
    setEditing((e) => (e ? { ...e, [key]: value } : e))
  }
  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (editing && (await run(() => payrollService.employees({ ...editing, active: isPayrollEmployeeActive(editing.retirementDate) }))))
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
        disabled={!catalogs}
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
    </Field>
  )
  const list = data.employees.map(employee => ({ ...employee, active: isPayrollEmployeeActive(employee.retirementDate) })).filter((e) =>
    `${employeeName(e)} ${e.identification}`
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
              disabled={!catalogs}
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
      {catalogError && (
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
        <form onSubmit={(e) => void save(e)}>
          <details className="payroll__card" open>
            <summary>Información personal</summary>
            <div className="payroll__section payroll__grid">
              {catalogField(
                'documentTypeId',
                'Tipo de documento',
                catalogs?.identifications,
              )}
              <Field label="Identificación">
                <input
                  required
                  pattern="[0-9]{5,20}"
                  value={editing.identification}
                  onChange={(e) => update('identification', e.target.value)}
                  onBlur={() => void lookupEmployee()}
                />
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
                  value={editing.contractType}
                  onChange={(e) => update('contractType', e.target.value)}
                >
                  {Object.entries(contractLabels).map(([key, name]) => (
                    <option key={key} value={key}>
                      {name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Cargo">
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
                    }), 'Cargo creado.')
                    if (!saved) throw new Error('No se pudo crear el cargo. Intenta nuevamente.')
                    return { id, name: name.trim() }
                  }}
                />
              </Field>
              <Field label="Fecha de ingreso">
                <input
                  type="date"
                  required
                  value={editing.admittanceDate}
                  onChange={(e) => update('admittanceDate', e.target.value)}
                />
              </Field>
              <Field label="Fecha de retiro">
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
              {(['integralSalary', 'highRiskPension'] as const).map(
                (key, i) => (
                  <label className="payroll__check" key={key}>
                    <input
                      type="checkbox"
                      checked={editing[key]}
                      onChange={(e) => update(key, e.target.checked)}
                    />
                    {
                      [
                        'Salario integral',
                        'Pensión de alto riesgo',
                      ][i]
                    }
                  </label>
                ),
              )}
              <Field label="Estado del empleado">
                <span className={`payroll__badge ${isPayrollEmployeeActive(editing.retirementDate) ? 'payroll__badge--ACCEPTED' : ''}`}>
                  {isPayrollEmployeeActive(editing.retirementDate) ? 'Activo' : 'Inactivo'}
                </span>
              </Field>
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
          <details className="payroll__card" open>
            <summary>Información de pago</summary>
            <div className="payroll__section payroll__grid">
              <Field label="Método de pago"><PayrollPaymentMethodSelect required value={editing.paymentMethodId} savedId={editing.jarvisPaymentMethodId} savedName={editing.paymentMethodName} onChange={method => setEditing({ ...editing, paymentMethodId: method?.nextpymeMethodId ?? 0, jarvisPaymentMethodId: method?.id, paymentMethodName: method?.name })} /></Field>
            </div>
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
              disabled={busy}
              className="payroll__button payroll__button--primary"
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
                placeholder="Nombre o identificación"
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
          <div className="payroll__footer">{list.length} empleados</div>
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
