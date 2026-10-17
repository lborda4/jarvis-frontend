import { useState } from 'react'
import {
  payrollService,
  type Employee,
  type Parameters,
  type PayrollState,
} from '../../services/payrollService'
import {
  totals,
  validatePayroll,
  VERIFIED_CONCEPTS,
  type PayrollLine,
} from '../../utils/payrollDomain'
import { suggestPayrollAmount } from '../../utils/payrollCalculation'
import { blankPayroll, currency, employeeName } from './payrollDefaults'
import { Field, Modal, type PayrollContext } from './PayrollPage'
interface Props extends PayrollContext {
  initial?: PayrollState
  documentId?: string
  parameterSnapshot?: Parameters
  employeeSnapshot?: Employee
  readOnly?: boolean
  onClose: () => void
  onSaved: () => Promise<void>
}
export default function PayrollEditor({
  data,
  run,
  busy,
  initial,
  documentId,
  parameterSnapshot,
  employeeSnapshot,
  readOnly,
  onClose,
  onSaved,
}: Props) {
  const [state, setState] = useState<PayrollState>(initial ?? blankPayroll())
  const [id] = useState(documentId ?? crypto.randomUUID())
  const [adding, setAdding] = useState<'accrued' | 'deduction' | null>(null)
  const [tab, setTab] = useState('Salario'),
    [concept, setConcept] = useState('salary'),
    [quantity, setQuantity] = useState('1'),
    [amount, setAmount] = useState('0'),
    [manual, setManual] = useState(false),
    [dates, setDates] = useState({
      startDate: state.startDate,
      endDate: state.endDate,
    }),
    [errors, setErrors] = useState<string[]>([]),
    [confirm, setConfirm] = useState(false)
  const employee =
    employeeSnapshot ?? data.employees.find((e) => e.id === state.employeeId)
  const parameters =
    parameterSnapshot ??
    data.parameters.find((p) => p.validFrom <= state.startDate)?.data
  const concepts = parameters?.concepts ?? []
  const selectedConcept = concepts.find((c) => c.code === concept)
  let suggestion: { amount: string; formula: string } | null = null
  try {
    if (employee && parameters && selectedConcept)
      suggestion = suggestPayrollAmount(
        employee,
        parameters,
        selectedConcept,
        quantity,
        state.workedDays,
      )
  } catch {
    /* incomplete input */
  }
  let total = { accrued: '0', deductions: '0', net: '0' }
  try {
    total = totals(state.lines)
  } catch {
    /* validation displays the error */
  }
  const chooseEmployee = (employeeId: string) => {
    const e = data.employees.find((w) => w.id === employeeId)
    let lines: PayrollLine[] = []
    const salary = parameters?.concepts.find((c) => c.code === 'salary')
    if (e && parameters && salary) {
      const suggested = suggestPayrollAmount(
        e,
        parameters,
        salary,
        state.workedDays,
        state.workedDays,
      )
      if (suggested)
        lines = [
          {
            id: crypto.randomUUID(),
            concept: 'salary',
            kind: 'accrued',
            amount: suggested.amount,
            quantity: state.workedDays,
            formula: suggested.formula,
          },
        ]
    }
    setState({ ...state, employeeId, lines })
  }
  const save = async () => {
    const validation = validatePayroll(state, employee)
    setErrors(validation)
    if (validation.length) return false
    const ok = await run(
      () => payrollService.save(id, state),
      'Nómina guardada.',
    )
    if (ok) await onSaved()
    return ok
  }
  const validate = async () => {
    if (await save()) {
      await run(async () => {
        const result = await payrollService.validate(id)
        setErrors(result.errors)
        if (!result.valid) throw new Error(result.errors.join(' '))
      }, 'Validación completada.')
    }
  }
  const add = () => {
    if (!selectedConcept) return
    const line: PayrollLine = {
      id: crypto.randomUUID(),
      concept,
      mapping: selectedConcept.code.startsWith('internal_')
        ? selectedConcept.category
        : selectedConcept.code,
      kind: selectedConcept.kind,
      quantity: selectedConcept.code === 'salary' ? state.workedDays : quantity,
      amount: manual ? amount : (suggestion?.amount ?? amount),
      percentage: selectedConcept.percentage || '0',
      manual: manual || !suggestion,
      formula: !manual ? suggestion?.formula : undefined,
      ...(['Incapacidades', 'Licencias', 'Vacaciones'].includes(
        selectedConcept.category,
      )
        ? dates
        : {}),
    }
    try {
      totals([line])
    } catch {
      setErrors(['Revisa el valor de la novedad.'])
      return
    }
    setState({ ...state, lines: [...state.lines, line] })
    setAdding(null)
  }
  return (
    <>
      <section className="payroll__card">
        <div className="payroll__footer">
          <h2 style={{ margin: 0 }}>
            {readOnly
              ? 'Consultar nómina'
              : state.originalId
                ? 'Nota de ajuste de nómina'
                : 'Preparar nómina'}
          </h2>
          <button className="payroll__button" onClick={onClose}>
            Volver
          </button>
        </div>
        <div className="payroll__section payroll__grid">
          <Field label="Empleado">
            <select
              disabled={readOnly || !!state.originalId}
              value={state.employeeId}
              onChange={(e) => chooseEmployee(e.target.value)}
            >
              <option value="">Seleccionar empleado</option>
              {employeeSnapshot &&
                !data.employees.some((e) => e.id === employeeSnapshot.id) && (
                  <option value={state.employeeId}>
                    {employeeName(employeeSnapshot)}
                  </option>
                )}
              {data.employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {employeeName(e)} · {e.identification}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Período">
            <input
              type="month"
              disabled={readOnly || !!state.payrollGroupId}
              value={state.period}
              onChange={(e) =>
                setState({
                  ...state,
                  ...blankPayroll(e.target.value),
                  employeeId: state.employeeId,
                  lines: state.lines,
                })
              }
            />
          </Field>
          {(['startDate', 'endDate', 'issueDate'] as const).map((key, i) => (
            <Field
              key={key}
              label={['Fecha inicial', 'Fecha final', 'Fecha de emisión'][i]}
            >
              <input
                type="date"
                disabled={
                  readOnly || (!!state.payrollGroupId && key !== 'issueDate')
                }
                value={state[key]}
                onChange={(e) => setState({ ...state, [key]: e.target.value })}
              />
            </Field>
          ))}
          <Field label="Días trabajados">
            <input
              disabled={readOnly}
              type="number"
              min="0.01"
              max="31"
              step="0.01"
              value={state.workedDays}
              onChange={(e) => {
                const days = e.target.value
                setState((s) => ({
                  ...s,
                  workedDays: days,
                  lines: s.lines.map((l) => {
                    if (
                      l.concept !== 'salary' ||
                      l.manual ||
                      !employee ||
                      !parameters
                    )
                      return l
                    try {
                      const c = concepts.find((c) => c.code === 'salary')!
                      const v = suggestPayrollAmount(
                        employee,
                        parameters,
                        c,
                        days,
                        days,
                      )
                      return v
                        ? {
                            ...l,
                            quantity: days,
                            amount: v.amount,
                            formula: v.formula,
                          }
                        : l
                    } catch {
                      return l
                    }
                  }),
                }))
              }}
            />
          </Field>
          <Field label="Fecha de ingreso">
            <input
              type="date"
              readOnly
              value={employee?.admittanceDate ?? ''}
            />
          </Field>
          <Field label="Método de pago del empleado">
            <input
              readOnly
              value={employee?.paymentMethodId || 'Sin configurar'}
            />
          </Field>
          <Field label="Fecha de pago">
            <input
              disabled={readOnly}
              type="date"
              value={state.paymentDates[0] ?? ''}
              onChange={(e) =>
                setState({ ...state, paymentDates: [e.target.value] })
              }
            />
          </Field>
        </div>
        {!parameters && (
          <div className="payroll__notice">
            Configura parámetros vigentes para este período antes de guardar.
          </div>
        )}
        <p className="payroll__section payroll__muted">
          {parameters
            ? `Parámetros vigentes desde ${parameters.validFrom}. `
            : ''}
          La fecha de pago se conserva en JARVIS; su transmisión y las fechas
          múltiples están pendientes de verificación del esquema de NextPyme.
        </p>
      </section>
      {(['accrued', 'deduction'] as const).map((kind) => (
        <section className="payroll__card" key={kind}>
          <div className="payroll__section">
            <h2>{kind === 'accrued' ? 'Devengados' : 'Deducciones'}</h2>
          </div>
          <div className="payroll__scroll">
            <table>
              <thead>
                <tr>
                  <th>Concepto</th>
                  <th>Cantidad / Días</th>
                  <th>Porcentaje</th>
                  <th>Valor</th>
                  {!readOnly && <th>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {state.lines
                  .filter((l) => l.kind === kind)
                  .map((l) => (
                    <tr key={l.id}>
                      <td>
                        {concepts.find((c) => c.code === l.concept)?.name ??
                          l.concept}
                        <small>
                          {l.manual ? 'Valor ingresado manualmente' : l.formula}
                        </small>
                        {!VERIFIED_CONCEPTS.includes(
                          l.mapping ?? l.concept,
                        ) && <small>Pendiente de integración</small>}
                      </td>
                      <td>
                        {readOnly ? (
                          l.quantity
                        ) : (
                          <input
                            aria-label="Cantidad del concepto"
                            readOnly={l.concept === 'salary'}
                            type="number"
                            min="0"
                            step="0.01"
                            value={l.quantity}
                            onChange={(e) => {
                              const quantity = e.target.value
                              const concept = concepts.find(
                                (c) => c.code === l.concept,
                              )
                              let suggestion: {
                                amount: string
                                formula: string
                              } | null = null
                              try {
                                if (
                                  employee &&
                                  parameters &&
                                  concept &&
                                  !l.manual
                                )
                                  suggestion = suggestPayrollAmount(
                                    employee,
                                    parameters,
                                    concept,
                                    quantity,
                                    state.workedDays,
                                  )
                              } catch {
                                /* incomplete quantity */
                              }
                              setState({
                                ...state,
                                lines: state.lines.map((line) =>
                                  line.id === l.id
                                    ? {
                                        ...line,
                                        quantity,
                                        ...(suggestion
                                          ? {
                                              amount: suggestion.amount,
                                              formula: suggestion.formula,
                                            }
                                          : {}),
                                      }
                                    : line,
                                ),
                              })
                            }}
                          />
                        )}
                      </td>
                      <td>
                        {l.kind === 'deduction' && !readOnly ? (
                          <input
                            aria-label="Porcentaje de deducción"
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={l.percentage ?? '0'}
                            onChange={(e) =>
                              setState({
                                ...state,
                                lines: state.lines.map((line) =>
                                  line.id === l.id
                                    ? { ...line, percentage: e.target.value }
                                    : line,
                                ),
                              })
                            }
                          />
                        ) : l.percentage ? (
                          `${l.percentage} %`
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        {readOnly ? (
                          currency(l.amount)
                        ) : (
                          <input
                            aria-label="Valor del concepto"
                            type="number"
                            min="0"
                            step="0.01"
                            value={l.amount}
                            onChange={(e) =>
                              setState({
                                ...state,
                                lines: state.lines.map((v) =>
                                  v.id === l.id
                                    ? {
                                        ...v,
                                        amount: e.target.value,
                                        manual: true,
                                      }
                                    : v,
                                ),
                              })
                            }
                          />
                        )}
                      </td>
                      {!readOnly && (
                        <td>
                          <button
                            className="payroll__link"
                            onClick={() =>
                              setState({
                                ...state,
                                lines: state.lines.filter((v) => v.id !== l.id),
                              })
                            }
                          >
                            Eliminar
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {!readOnly && (
            <div className="payroll__section">
              <button
                className="payroll__button"
                disabled={!employee || !parameters}
                onClick={() => {
                  setAdding(kind)
                  setTab(kind === 'deduction' ? 'Deducciones' : 'Salario')
                  setConcept(kind === 'deduction' ? 'eps' : 'salary')
                  setManual(false)
                  setQuantity('1')
                  setAmount('0')
                }}
              >
                + Agregar {kind === 'accrued' ? 'devengado' : 'deducción'}
              </button>
            </div>
          )}
        </section>
      ))}
      <section className="payroll__card">
        <div className="payroll__summary">
          <div>
            <span>Total devengados</span>
            <strong>{currency(total.accrued)}</strong>
          </div>
          <div>
            <span>Total deducciones</span>
            <strong>{currency(total.deductions)}</strong>
          </div>
          <div>
            <span>Total neto</span>
            <strong>{currency(total.net)}</strong>
          </div>
        </div>
      </section>
      {!!errors.length && (
        <div className="payroll__notice payroll__notice--error" role="alert">
          <ul>
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}
      {!readOnly && (
        <div className="payroll__toolbar">
          <button
            disabled={busy}
            className="payroll__button"
            onClick={() => void save()}
          >
            Guardar borrador
          </button>
          <button
            disabled={busy}
            className="payroll__button"
            onClick={() => void validate()}
          >
            Validar
          </button>
          <button
            disabled={busy}
            className="payroll__button payroll__button--primary"
            onClick={() => {
              const v = validatePayroll(state, employee, true)
              setErrors(v)
              if (!v.length) setConfirm(true)
            }}
          >
            Enviar a la DIAN
          </button>
        </div>
      )}
      {adding && (
        <Modal
          title={`Novedades de ${employee ? employeeName(employee) : 'empleado'}`}
          subtitle={`${state.period} · ${adding === 'accrued' ? 'Ingresos' : 'Deducciones'}`}
          onClose={() => setAdding(null)}
        >
          <div className="payroll__tabs">
            {[
              ...new Set(
                concepts
                  .filter((c) => c.kind === adding && c.active)
                  .map((c) => c.category),
              ),
            ].map((category) => (
              <button
                className="payroll__button"
                key={category}
                aria-selected={category === tab}
                onClick={() => {
                  setTab(category)
                  setConcept(
                    concepts.find(
                      (c) =>
                        c.category === category &&
                        c.kind === adding &&
                        c.active,
                    )?.code ?? '',
                  )
                }}
              >
                {category}
              </button>
            ))}
          </div>
          <div className="payroll__grid payroll__grid--two">
            <Field label="Concepto">
              <select
                value={concept}
                onChange={(e) => {
                  setConcept(e.target.value)
                  setManual(false)
                }}
              >
                {concepts
                  .filter(
                    (c) => c.kind === adding && c.active && c.category === tab,
                  )
                  .map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Cantidad / Días / Horas">
              <input
                type="number"
                min="0"
                step="0.01"
                value={
                  selectedConcept?.code === 'salary'
                    ? state.workedDays
                    : quantity
                }
                readOnly={selectedConcept?.code === 'salary'}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </Field>
            {selectedConcept?.factor && (
              <Field label="Factor total">
                <input readOnly value={selectedConcept.factor} />
              </Field>
            )}
            <Field
              label={
                suggestion && !manual ? 'Valor calculado' : 'Valor liquidado'
              }
            >
              <input
                type="number"
                min="0"
                step="0.01"
                value={!manual && suggestion ? suggestion.amount : amount}
                onChange={(e) => {
                  setAmount(e.target.value)
                  setManual(true)
                }}
              />
            </Field>
            {selectedConcept &&
              ['Incapacidades', 'Licencias', 'Vacaciones'].includes(
                selectedConcept.category,
              ) && (
                <>
                  <Field label="Desde">
                    <input
                      type="date"
                      value={dates.startDate}
                      onChange={(e) =>
                        setDates({ ...dates, startDate: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Hasta">
                    <input
                      type="date"
                      value={dates.endDate}
                      onChange={(e) =>
                        setDates({ ...dates, endDate: e.target.value })
                      }
                    />
                  </Field>
                </>
              )}
          </div>
          <p className="payroll__muted">
            {suggestion && !manual
              ? suggestion.formula
              : 'Ingresa el valor liquidado; no hay una regla automática verificada para este concepto.'}
          </p>
          {!VERIFIED_CONCEPTS.includes(
            selectedConcept?.code.startsWith('internal_')
              ? selectedConcept.category
              : concept,
          ) && (
            <p className="payroll__notice">
              Este concepto puede guardarse. Su envío queda pendiente de
              verificar el mapeo con NextPyme.
            </p>
          )}
          <div className="payroll__footer">
            <button className="payroll__button" onClick={() => setAdding(null)}>
              Cancelar
            </button>
            <button
              className="payroll__button payroll__button--primary"
              onClick={add}
            >
              Agregar novedad
            </button>
          </div>
        </Modal>
      )}
      {confirm && (
        <Modal
          title="Enviar nómina a la DIAN"
          onClose={() => setConfirm(false)}
        >
          <p>
            Se transmitirá la nómina de {employee && employeeName(employee)} por{' '}
            {currency(total.net)} en el ambiente guardado de{' '}
            {data.settings.environment === 1 ? 'producción' : 'pruebas'}.
          </p>
          <div className="payroll__toolbar">
            <button
              className="payroll__button"
              onClick={() => setConfirm(false)}
            >
              Cancelar
            </button>
            <button
              disabled={busy}
              className="payroll__button payroll__button--primary"
              onClick={() =>
                void (async () => {
                  setConfirm(false)
                  if (await save()) {
                    const ok = await run(
                      () => payrollService.send(id),
                      'Resultado de envío actualizado.',
                    )
                    await onSaved()
                    if (ok) onClose()
                  }
                })()
              }
            >
              Confirmar envío
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
