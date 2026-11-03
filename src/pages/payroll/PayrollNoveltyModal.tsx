import { useState, type FormEvent } from 'react'
import type {
  Concept,
  PayrollDetail,
  PayrollState,
} from '../../services/payrollService'
import type { PayrollLine } from '../../utils/payrollDomain'
import { suggestPayrollAmount } from '../../utils/payrollCalculation'
import { employeeName } from './payrollDefaults'
import { Field, Modal } from './PayrollPage'
import PayrollMoneyInput from './PayrollMoneyInput'
import { payrollNoveltyLine } from './payrollNoveltyDomain'

export default function PayrollNoveltyModal({
  detail,
  concepts,
  initial,
  busy,
  onClose,
  onSave,
}: {
  detail: PayrollDetail
  concepts: Concept[]
  initial?: PayrollLine
  busy: boolean
  onClose: () => void
  onSave: (state: PayrollState) => Promise<void>
}) {
  const [search, setSearch] = useState('')
  const [code, setCode] = useState(initial?.concept ?? '')
  const [quantity, setQuantity] = useState(initial?.quantity ?? '1')
  const [amount, setAmount] = useState(initial?.amount ?? '0')
  const [percentage, setPercentage] = useState(initial?.percentage ?? '')
  const [manual, setManual] = useState(Boolean(initial?.manual))
  const [startDate, setStartDate] = useState(
    initial?.startDate ?? detail.state.startDate,
  )
  const [endDate, setEndDate] = useState(
    initial?.endDate ?? detail.state.endDate,
  )
  const [error, setError] = useState('')
  const concept =
    concepts.find((item) => item.code === code) ??
    (initial && code === initial.concept
      ? detail.parameter_snapshot.concepts.find((item) => item.code === code)
      : undefined)
  const choices = concepts.filter(
    (item) =>
      item.active &&
      `${item.name} ${item.category}`
        .toLocaleLowerCase('es')
        .includes(search.toLocaleLowerCase('es')),
  )
  const selectedQuantity =
    code === 'salary' ? detail.state.workedDays : quantity
  let suggestion: { amount: string; formula: string } | null = null
  try {
    if (concept)
      suggestion = suggestPayrollAmount(
        detail.employee_snapshot,
        detail.parameter_snapshot,
        { ...concept, percentage: percentage || concept.percentage },
        selectedQuantity,
        detail.state.workedDays,
      )
  } catch {
    /* Incomplete quantity remains editable. */
  }
  const value = !manual && suggestion ? suggestion.amount : amount
  const dated =
    concept &&
    ['Incapacidades', 'Licencias', 'Vacaciones'].includes(concept.category)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!concept || busy) return
    setError('')
    try {
      const line = payrollNoveltyLine(detail.state, concept, {
        id: initial?.id ?? crypto.randomUUID(),
        quantity: selectedQuantity,
        amount: value,
        percentage: percentage || concept.percentage || '0',
        manual: manual || !suggestion,
        ...(!manual && suggestion ? { formula: suggestion.formula } : {}),
        ...(dated ? { startDate, endDate } : {}),
      })
      await onSave({
        ...detail.state,
        lines: initial
          ? detail.state.lines.map((item) =>
              item.id === initial.id ? line : item,
            )
          : [...detail.state.lines, line],
      })
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'No se pudo guardar la novedad.',
      )
    }
  }
  return (
    <Modal
      title={initial ? 'Editar novedad' : 'Añadir novedad'}
      subtitle={employeeName(detail.employee_snapshot)}
      onClose={() => {
        if (!busy) onClose()
      }}
    >
      <form onSubmit={(event) => void submit(event)}>
        {!initial && (
          <Field label="Buscar concepto">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nombre o categoría"
            />
          </Field>
        )}
        <div className="payroll__grid payroll__grid--two">
          <Field label="Concepto">
            <select
              required
              value={code}
              disabled={busy}
              onChange={(event) => {
                setCode(event.target.value)
                setManual(false)
                setAmount('0')
                setPercentage('')
              }}
            >
              <option value="">Seleccionar concepto</option>
              {[
                ...new Set(
                  choices.map((item) => `${item.kind}|${item.category}`),
                ),
              ].map((group) => {
                const [kind, category] = group.split('|')
                return (
                  <optgroup
                    key={group}
                    label={`${kind === 'accrued' ? 'Ingresos' : 'Deducciones'} · ${category}`}
                  >
                    {choices
                      .filter(
                        (item) =>
                          item.kind === kind && item.category === category,
                      )
                      .map((item) => (
                        <option key={item.code} value={item.code}>
                          {item.name}
                        </option>
                      ))}
                  </optgroup>
                )
              })}
              {concept && !choices.some((item) => item.code === code) && (
                <option value={code}>{concept.name}</option>
              )}
            </select>
          </Field>
          <Field label="Cantidad / días / horas">
            <input
              required
              type="number"
              min="0.01"
              step="0.01"
              value={selectedQuantity}
              readOnly={code === 'salary'}
              disabled={busy}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </Field>
          <Field label={suggestion && !manual ? 'Valor calculado' : 'Valor'}>
            <PayrollMoneyInput
              value={value}
              disabled={busy}
              onValueChange={(next) => {
                setAmount(next)
                setManual(true)
              }}
            />
          </Field>
          <Field label="Porcentaje">
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={percentage || concept?.percentage || ''}
              disabled={busy}
              onChange={(event) => setPercentage(event.target.value)}
            />
          </Field>
          {dated && (
            <>
              <Field label="Desde">
                <input
                  type="date"
                  required
                  value={startDate}
                  disabled={busy}
                  onChange={(event) => setStartDate(event.target.value)}
                />
              </Field>
              <Field label="Hasta">
                <input
                  type="date"
                  required
                  value={endDate}
                  disabled={busy}
                  onChange={(event) => setEndDate(event.target.value)}
                />
              </Field>
            </>
          )}
        </div>
        {!concepts.some((item) => item.active) && (
          <p>
            No hay conceptos activos. Agrégalos en la configuración de nómina.
          </p>
        )}
        {error && (
          <p className="payroll__notice payroll__notice--error" role="alert">
            {error}
          </p>
        )}
        <div className="payroll__toolbar payroll__novelty-actions">
          <button
            type="button"
            className="payroll__button"
            disabled={busy}
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            className="payroll__button payroll__button--primary"
            disabled={busy || !concept}
          >
            Guardar novedad
          </button>
        </div>
      </form>
    </Modal>
  )
}
