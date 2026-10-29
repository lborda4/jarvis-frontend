import { useState, type FormEvent } from 'react'
import { payrollService, type Employee } from '../../services/payrollService'
import {
  blankEmployee,
  contractLabels,
  currency,
  employeeName,
  payrollParametersForSettings,
} from './payrollDefaults'
import { Field, PayrollHeading, type PayrollContext } from './PayrollPage'
import PayrollImport from './PayrollImport'
import usePayrollCatalogs from './usePayrollCatalogs'
import PayrollMoneyInput from './PayrollMoneyInput'
import PayrollPaymentMethodSelect from './PayrollPaymentMethodSelect'
import Autocomplete from '../../components/Autocomplete'
export default function PayrollEmployees({ data, run, busy }: PayrollContext) {
  const {
    catalogs,
    error: catalogError,
    reload: reloadCatalogs,
  } = usePayrollCatalogs()
  const [editing, setEditing] = useState<Employee | null>(null),
    [search, setSearch] = useState(''),
    [importing, setImporting] = useState(false)
  const update = (key: keyof Employee, value: Employee[keyof Employee]) =>
    setEditing((e) => (e ? { ...e, [key]: value } : e))
  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (editing && (await run(() => payrollService.employees(editing))))
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
  const list = data.employees.filter((e) =>
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
                  salary: payrollParametersForSettings(data.parameters[0]?.data).minimumSalary,
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
                />
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
              {(['integralSalary', 'highRiskPension', 'active'] as const).map(
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
                        'Empleado activo',
                      ][i]
                    }
                  </label>
                ),
              )}
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
              <Field label="Banco (si aplica)">
                <input
                  value={editing.bankName}
                  onChange={(e) => update('bankName', e.target.value)}
                />
              </Field>
              {editing.bankName && (
                <>
                  <Field label="Tipo de cuenta">
                    <input
                      required
                      value={editing.accountType}
                      onChange={(e) => update('accountType', e.target.value)}
                    />
                  </Field>
                  <Field label="Número de cuenta">
                    <input
                      required
                      value={editing.accountNumber}
                      onChange={(e) => update('accountNumber', e.target.value)}
                    />
                  </Field>
                </>
              )}
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
                      <button
                        disabled={busy}
                        className="payroll__link"
                        onClick={() =>
                          void run(() =>
                            payrollService.employees({
                              ...e,
                              active: !e.active,
                            }),
                          )
                        }
                      >
                        {e.active ? 'Inactivar' : 'Activar'}
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
