import { useState } from 'react'
import {
  payrollService,
  type Parameters,
  type PayrollSettings,
  type Position,
} from '../../services/payrollService'
import { VERIFIED_CONCEPTS } from '../../utils/payrollDomain'
import { blankParameters, currency } from './payrollDefaults'
import { Field, PayrollHeading, type PayrollContext } from './PayrollPage'
import usePayrollCatalogs from './usePayrollCatalogs'
export default function PayrollSettingsPage({
  data,
  run,
  busy,
}: PayrollContext) {
  const {
    catalogs,
    error: catalogError,
    reload: reloadCatalogs,
  } = usePayrollCatalogs()
  const [parameters, setParameters] = useState<Parameters>(
    () => data.parameters[0]?.data ?? blankParameters(),
  )
  const [settings, setSettings] = useState<PayrollSettings>(data.settings)
  const [position, setPosition] = useState<Position | null>(null)
  const field = (key: keyof Parameters, label: string, type = 'number') => (
    <Field label={label}>
      <input
        type={type}
        min={type === 'number' ? '0' : undefined}
        step={type === 'number' ? '0.01' : undefined}
        value={String(parameters[key])}
        onChange={(e) =>
          setParameters({ ...parameters, [key]: e.target.value })
        }
      />
    </Field>
  )
  const conceptSection = (kind: 'accrued' | 'deduction') => (
    <>
      <div className="payroll__scroll">
        <table>
          <thead>
            <tr>
              {[
                'Concepto',
                'Categoría de transmisión',
                'Base de sugerencia',
                'Factor total',
                'Porcentaje',
                'Salarial',
                'Activo',
              ].map((t) => (
                <th key={t}>{t}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {parameters.concepts.map(
              (c, i) =>
                c.kind === kind && (
                  <tr key={i}>
                    <td>
                      <input
                        aria-label="Nombre del concepto"
                        value={c.name}
                        onChange={(e) => change(i, 'name', e.target.value)}
                      />
                      <small>
                        {VERIFIED_CONCEPTS.includes(c.code)
                          ? 'Mapeo verificado'
                          : 'Pendiente de integración'}
                      </small>
                    </td>
                    <td>
                      {c.code.startsWith('internal_') ? (
                        <select
                          aria-label="Categoría"
                          value={c.category}
                          onChange={(e) =>
                            change(i, 'category', e.target.value)
                          }
                        >
                          <option value="">Seleccionar</option>
                          {parameters.concepts
                            .filter(
                              (t) =>
                                t.kind === kind &&
                                !t.code.startsWith('internal_'),
                            )
                            .map((t) => (
                              <option key={t.code} value={t.code}>
                                {t.name}
                              </option>
                            ))}
                        </select>
                      ) : (
                        c.category
                      )}
                    </td>
                    <td>
                      <select
                        aria-label="Base de cálculo"
                        value={c.base}
                        onChange={(e) => change(i, 'base', e.target.value)}
                      >
                        <option value="manual">Manual</option>
                        <option value="salary">Salario devengado</option>
                        <option value="hourly">
                          Salario / horas de referencia
                        </option>
                      </select>
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        aria-label="Factor total"
                        value={c.factor}
                        onChange={(e) => change(i, 'factor', e.target.value)}
                      />
                      <small>
                        {c.factor &&
                          `Adicional: ${((Number(c.factor) - 1) * 100).toFixed(2)} %`}
                      </small>
                      <select
                        aria-label="Aplicación del factor"
                        value={c.calculationMode ?? 'total'}
                        onChange={(e) =>
                          change(i, 'calculationMode', e.target.value)
                        }
                      >
                        <option value="total">Remuneración total</option>
                        <option value="additional">
                          Solo recargo adicional
                        </option>
                      </select>
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        aria-label="Porcentaje"
                        value={c.percentage}
                        onChange={(e) =>
                          change(i, 'percentage', e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        aria-label="Salarial"
                        checked={c.salaried}
                        onChange={(e) =>
                          change(i, 'salaried', e.target.checked)
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        aria-label="Activo"
                        checked={c.active}
                        onChange={(e) => change(i, 'active', e.target.checked)}
                      />
                    </td>
                  </tr>
                ),
            )}
          </tbody>
        </table>
      </div>
      <div className="payroll__section">
        <button
          className="payroll__button"
          type="button"
          onClick={() =>
            setParameters({
              ...parameters,
              concepts: [
                ...parameters.concepts,
                {
                  code: `internal_${crypto.randomUUID()}`,
                  name: 'Nuevo concepto',
                  kind,
                  category: '',
                  factor: '',
                  percentage: '',
                  base: 'manual',
                  salaried: false,
                  active: true,
                },
              ],
            })
          }
        >
          + Agregar concepto
        </button>
      </div>
    </>
  )
  const change = (index: number, key: string, value: string | boolean) =>
    setParameters((p) => ({
      ...p,
      concepts: p.concepts.map((c, i) =>
        i === index ? { ...c, [key]: value } : c,
      ),
    }))
  return (
    <>
      <PayrollHeading
        title="Configuración de nómina electrónica"
        description="Administra los parámetros, conceptos y factores utilizados para preparar tus nóminas electrónicas."
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
      <details className="payroll__card" open>
        <summary>Parámetros generales</summary>
        <div className="payroll__section">
          <p className="payroll__muted">
            Cada fecha crea una versión inmutable. Ingresa valores verificados
            para la vigencia: no se precargan tarifas legales sin confirmar.
          </p>
          <div className="payroll__grid">
            <Field label="Consultar versión">
              <select
                value={parameters.validFrom}
                onChange={(e) => {
                  const item = data.parameters.find(
                    (p) => p.validFrom === e.target.value,
                  )
                  if (item) setParameters(item.data)
                }}
              >
                <option value={parameters.validFrom}>
                  {parameters.validFrom}
                </option>
                {data.parameters
                  .filter((p) => p.validFrom !== parameters.validFrom)
                  .map((p) => (
                    <option key={p.id} value={p.validFrom}>
                      {p.validFrom}
                    </option>
                  ))}
              </select>
            </Field>
            {field('validFrom', 'Vigente desde', 'date')}
            {field('minimumSalary', 'Salario mínimo legal')}
            {field('transportAllowance', 'Auxilio de transporte')}
            {field('weeklyHours', 'Jornada máxima semanal (horas)')}
            {field('monthlyHours', 'Horas de referencia mensual')}
            {field('monthlyDays', 'Días de referencia mensual')}
            {field('nightStart', 'Inicio de jornada nocturna', 'time')}
            <Field label="Método de pago predeterminado">
              <select
                disabled={!catalogs}
                value={parameters.paymentMethodId || ''}
                onChange={(e) =>
                  setParameters({
                    ...parameters,
                    paymentMethodId: Number(e.target.value),
                  })
                }
              >
                <option value="">Seleccionar</option>
                {catalogs?.paymentMethods?.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>
      </details>
      <details className="payroll__card">
        <summary>Devengados, horas extras y recargos</summary>
        {conceptSection('accrued')}
      </details>
      <details className="payroll__card">
        <summary>Deducciones del empleado</summary>
        <p className="payroll__section payroll__muted">
          Las bases y porcentajes se aplican únicamente cuando estén
          configurados. Las obligaciones del empleador no se descuentan al
          trabajador.
        </p>
        {conceptSection('deduction')}
      </details>
      <button
        className="payroll__button payroll__button--primary"
        disabled={busy}
        onClick={() =>
          void run(
            () => payrollService.parameters(parameters),
            'Versión de parámetros guardada.',
          )
        }
      >
        Guardar nueva vigencia de parámetros y conceptos
      </button>
      <details className="payroll__card">
        <summary>Cargos</summary>
        <div className="payroll__section">
          <button
            className="payroll__button"
            onClick={() =>
              setPosition({
                id: crypto.randomUUID(),
                code: '',
                name: '',
                salary: '0',
                active: true,
              })
            }
          >
            + Crear cargo
          </button>
        </div>
        <div className="payroll__scroll">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Cargo</th>
                <th>Salario de referencia</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {data.positions.map((p) => (
                <tr key={p.id}>
                  <td>{p.code}</td>
                  <td>{p.name}</td>
                  <td>{currency(p.salary)}</td>
                  <td>{p.active ? 'Activo' : 'Inactivo'}</td>
                  <td>
                    <button
                      className="payroll__link"
                      onClick={() => setPosition({ ...p })}
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {position && (
          <form
            className="payroll__section"
            onSubmit={(e) => {
              e.preventDefault()
              void run(() => payrollService.position(position)).then((ok) => {
                if (ok) setPosition(null)
              })
            }}
          >
            <div className="payroll__grid">
              {(['code', 'name', 'salary'] as const).map((key, i) => (
                <Field
                  label={['Código', 'Cargo', 'Salario de referencia'][i]}
                  key={key}
                >
                  <input
                    required
                    type={key === 'salary' ? 'number' : 'text'}
                    min="0"
                    step="0.01"
                    value={position[key]}
                    onChange={(e) =>
                      setPosition({ ...position, [key]: e.target.value })
                    }
                  />
                </Field>
              ))}
            </div>
            <div className="payroll__toolbar" style={{ marginTop: 18 }}>
              <label className="payroll__check">
                <input
                  type="checkbox"
                  checked={position.active}
                  onChange={(e) =>
                    setPosition({ ...position, active: e.target.checked })
                  }
                />
                Activo
              </label>
              <button
                disabled={busy}
                className="payroll__button payroll__button--primary"
              >
                Guardar cargo
              </button>
              <button
                type="button"
                className="payroll__button"
                onClick={() => setPosition(null)}
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
      </details>
      <details className="payroll__card">
        <summary>Configuración DIAN</summary>
        <div className="payroll__section">
          <div className="payroll__grid">
            <Field label="Ambiente de nómina">
              <select
                value={settings.environment}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    environment: Number(e.target.value),
                  })
                }
              >
                <option value={2}>Pruebas</option>
                <option value={1}>Producción</option>
              </select>
            </Field>
            <Field label="Prefijo interno">
              <input
                maxLength={20}
                value={settings.prefix}
                onChange={(e) =>
                  setSettings({ ...settings, prefix: e.target.value })
                }
              />
            </Field>
            <Field label="Siguiente consecutivo">
              <input readOnly value={data.nextNumber} />
            </Field>
            <label className="payroll__check">
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(e) =>
                  setSettings({ ...settings, enabled: e.target.checked })
                }
              />
              Permitir envío de nómina
            </label>
          </div>
          <p className="payroll__muted">
            La numeración es independiente de las resoluciones de facturas. El
            ambiente se sincroniza con NextPyme mediante una acción explícita.
            Se requiere un plan de nómina verificado antes de enviar.
          </p>
          <div className="payroll__toolbar">
            <button
              className="payroll__button payroll__button--primary"
              disabled={busy}
              onClick={() => void run(() => payrollService.settings(settings))}
            >
              Guardar configuración
            </button>
            <button
              className="payroll__button"
              disabled={busy}
              onClick={() =>
                void run(
                  () => payrollService.environment(),
                  'Ambiente sincronizado con NextPyme.',
                )
              }
            >
              Sincronizar ambiente guardado
            </button>
          </div>
        </div>
      </details>
    </>
  )
}
