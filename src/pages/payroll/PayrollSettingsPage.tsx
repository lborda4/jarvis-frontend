import { useEffect, useRef, useState } from 'react'
import {
  payrollService,
  type Parameters,
  type Concept,
} from '../../services/payrollService'
import { VERIFIED_CONCEPTS } from '../../utils/payrollDomain'
import { monthlyHoursForWeek, payrollParametersForSettings } from './payrollDefaults'
import { Field, PayrollHeading, type PayrollContext } from './PayrollPage'
import PayrollMoneyInput from './PayrollMoneyInput'
import PayrollPaymentMethodSelect from './PayrollPaymentMethodSelect'
export default function PayrollSettingsPage({
  data,
  run,
  busy,
}: PayrollContext) {
  const [parameters, setParameters] = useState<Parameters>(
    () => payrollParametersForSettings(data.parameters[0]?.data),
  )
  const [newConcept, setNewConcept] = useState<Concept | null>(null)
  const [conceptError, setConceptError] = useState('')
  const [conceptNotice, setConceptNotice] = useState('')
  const newConceptRow = useRef<HTMLTableRowElement>(null)
  const newConceptCode = newConcept?.code

  useEffect(() => {
    if (!newConceptCode) return
    newConceptRow.current?.querySelector<HTMLInputElement>('input')?.focus()
    const discard = (event: PointerEvent) => {
      if (event.target instanceof Node && !newConceptRow.current?.contains(event.target)) {
        setNewConcept(null)
        setConceptError('')
      }
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setNewConcept(null); setConceptError('') }
    }
    document.addEventListener('pointerdown', discard)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', discard)
      document.removeEventListener('keydown', escape)
    }
  }, [newConceptCode])

  const saveNewConcept = () => {
    if (!newConcept || busy) return
    if (!newConcept.name.trim()) { setConceptError('Escribe el nombre del concepto.'); return }
    if (!parameters.concepts.some(concept => concept.code === newConcept.category && concept.kind === newConcept.kind && !concept.code.startsWith('internal_'))) {
      setConceptError('Selecciona la categoría del concepto.'); return
    }
    if ((newConcept.factor && (!Number.isFinite(Number(newConcept.factor)) || Number(newConcept.factor) < 0)) ||
      (newConcept.percentage && (!Number.isFinite(Number(newConcept.percentage)) || Number(newConcept.percentage) < 0 || Number(newConcept.percentage) > 100)) ||
      (newConcept.calculationMode === 'additional' && newConcept.factor && Number(newConcept.factor) < 1)) {
      setConceptError('Revisa el factor y el porcentaje del concepto.'); return
    }
    setParameters(current => ({ ...current, concepts: [...current.concepts, { ...newConcept, name: newConcept.name.trim() }] }))
    setNewConcept(null)
    setConceptError('')
    setConceptNotice('Concepto agregado. Pulsa Guardar para guardar los cambios de configuración.')
  }
  const field = (key: keyof Parameters, label: string, type = 'number') => (
    <Field label={label}>
      {key === 'minimumSalary' || key === 'transportAllowance' ? <PayrollMoneyInput value={parameters[key]} onValueChange={value => setParameters({ ...parameters, [key]: value })} /> : <input
        type={type}
        min={type === 'number' ? '0' : undefined}
        step={type === 'number' ? '0.01' : undefined}
        value={String(parameters[key])}
        onChange={(e) =>
          setParameters({ ...parameters, [key]: e.target.value, ...(key === 'weeklyHours' ? { monthlyHours: monthlyHoursForWeek(e.target.value) } : {}) })
        }
      />}
    </Field>
  )
  const conceptSection = (kind: 'accrued' | 'deduction') => (
    <>
      <div className="payroll__scroll">
        <table className="payroll__concepts" aria-label={kind === 'accrued' ? 'Conceptos de devengados, horas extras y recargos' : 'Conceptos de deducciones'}>
          <colgroup>
            <col className="payroll__concept-col-name" />
            <col className="payroll__concept-col-category" />
            <col className="payroll__concept-col-base" />
            <col className="payroll__concept-col-factor" />
            <col className="payroll__concept-col-mode" />
            <col className="payroll__concept-col-percent" />
            <col className="payroll__concept-col-check" />
            <col className="payroll__concept-col-check" />
          </colgroup>
          <thead>
            <tr>
              {[
                'Concepto',
                'Categoría',
                'Base de cálculo',
                'Factor total',
                'Aplicación',
                '%',
                'Salarial',
                'Activo',
              ].map((t) => (
                <th scope="col" key={t}>{t}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...parameters.concepts, ...(newConcept ? [newConcept] : [])].map(
              (c) =>
                c.kind === kind && (
                  <tr key={c.code} ref={c.code === newConceptCode ? newConceptRow : undefined} className={c.code === newConceptCode ? 'payroll__concept-draft' : undefined}>
                    <td>
                      <input
                        aria-label="Nombre del concepto"
                        title={c.name}
                        placeholder="Nuevo concepto"
                        value={c.name}
                        onChange={(e) => change(c.code, 'name', e.target.value)}
                      />
                      <small>
                        {c.code === newConceptCode ? 'Sin guardar' : VERIFIED_CONCEPTS.includes(c.code)
                          ? 'Mapeo verificado'
                          : 'Pendiente de integración'}
                      </small>
                      {c.code === newConceptCode && <>
                        <div className="payroll__concept-draft-actions">
                          <button type="button" className="payroll__button payroll__button--primary" disabled={busy} onClick={saveNewConcept}>Guardar concepto</button>
                          <button type="button" className="payroll__button" onClick={() => { setNewConcept(null); setConceptError('') }}>Eliminar</button>
                        </div>
                        {conceptError && <small role="alert" className="payroll__concept-error">{conceptError}</small>}
                      </>}
                    </td>
                    <td>
                      {c.code.startsWith('internal_') ? (
                        <select
                          aria-label="Categoría"
                          value={c.category}
                          onChange={(e) =>
                            change(c.code, 'category', e.target.value)
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
                        onChange={(e) => change(c.code, 'base', e.target.value)}
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
                        onChange={(e) => change(c.code, 'factor', e.target.value)}
                      />
                      {c.factor && <small>Adic.: {((Number(c.factor) - 1) * 100).toFixed(2)} %</small>}
                    </td>
                    <td>
                      <select
                        aria-label="Aplicación del factor"
                        value={c.calculationMode ?? 'total'}
                        onChange={(e) =>
                          change(c.code, 'calculationMode', e.target.value)
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
                          change(c.code, 'percentage', e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        aria-label="Salarial"
                        checked={c.salaried}
                        onChange={(e) =>
                          change(c.code, 'salaried', e.target.checked)
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        aria-label="Activo"
                        checked={c.active}
                        onChange={(e) => change(c.code, 'active', e.target.checked)}
                      />
                    </td>
                  </tr>
                ),
            )}
          </tbody>
        </table>
      </div>
      <div className="payroll__section payroll__concepts-actions">
        <button
          className="payroll__button"
          type="button"
          disabled={Boolean(newConcept) || busy}
          onClick={() => {
            if (newConcept) return
            setConceptError('')
            setConceptNotice('')
            setNewConcept({
                  code: `internal_${crypto.randomUUID()}`,
                  name: '',
                  kind,
                  category: '',
                  factor: '',
                  percentage: '',
                  base: 'manual',
                  salaried: false,
                  active: true,
                  calculationMode: 'total',
            })
          }}
        >
          + Agregar concepto
        </button>
        {newConcept?.kind === kind && <small className="payroll__muted">Guarda este concepto antes de crear otro. Si haces clic fuera de la fila, se descartará.</small>}
      </div>
    </>
  )
  const change = (code: string, key: keyof Concept, value: string | boolean) => {
    if (code === newConceptCode) {
      setNewConcept(current => current ? { ...current, [key]: value } : null)
      setConceptError('')
      return
    }
    setParameters((p) => ({
      ...p,
      concepts: p.concepts.map((c) =>
        c.code === code ? { ...c, [key]: value } : c,
      ),
    }))
  }
  return (
    <>
      <PayrollHeading
        title="Configuración de nómina electrónica"
        description="Administra los parámetros, conceptos y factores utilizados para preparar tus nóminas electrónicas."
      />
      <details className="payroll__card" open>
        <summary>Parámetros generales</summary>
        <div className="payroll__section">
          <p className="payroll__muted">
            Revisa los parámetros antes de guardarlos. El salario mínimo y el
            auxilio de transporte y la jornada semanal se proponen según la fecha actual y puedes modificarlos.
          </p>
          <div className="payroll__grid">
            {field('minimumSalary', 'Salario mínimo legal')}
            {field('transportAllowance', 'Auxilio de transporte')}
            {field('weeklyHours', 'Jornada máxima semanal (horas)')}
            {field('monthlyDays', 'Días de referencia mensual')}
            <Field label="Método de pago predeterminado">
              <PayrollPaymentMethodSelect value={parameters.paymentMethodId} savedId={parameters.jarvisPaymentMethodId} savedName={parameters.paymentMethodName} onChange={method => setParameters({ ...parameters, paymentMethodId: method?.nextpymeMethodId ?? 0, jarvisPaymentMethodId: method?.id, paymentMethodName: method?.name })} />
            </Field>
          </div>
        </div>
      </details>
      <details className="payroll__card payroll__concepts-card">
        <summary>Devengados, horas extras y recargos</summary>
        {conceptSection('accrued')}
      </details>
      <details className="payroll__card payroll__concepts-card">
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
        onClick={async () => {
          const saved = await run(
            () => payrollService.parameters(parameters),
            'Versión de parámetros guardada.',
          )
          if (saved) setConceptNotice('')
        }}
      >
        Guardar
      </button>
      {conceptNotice && <p role="status" className="payroll__muted">{conceptNotice}</p>}
    </>
  )
}
