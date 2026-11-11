import { useEffect, useRef, useState, type FormEvent } from 'react'
import { payrollService, type Concept, type PayrollDetail, type PayrollState } from '../../services/payrollService'
import { isPayrollOvertime } from '../../utils/payrollOvertime'
import { validatePayroll, type PayrollLine } from '../../utils/payrollDomain'
import { shouldShowTablePagination } from '../../utils/tablePagination'
import { currency, employeeName } from './payrollDefaults'
import { Field, Modal } from './PayrollPage'
import PayrollMoneyInput from './PayrollMoneyInput'
import { payrollNoveltyDateBounds, payrollNoveltyDateQuantity, payrollNoveltyLine } from './payrollNoveltyDomain'
import { isPayrollSalaryAllowance, payrollIncomeCategories, payrollIncomeCategory } from './payrollIncomeCategories'
import { payrollDeductionCategories, payrollDeductionCategory, payrollSocialDeductions, type PayrollSocialDeduction } from './payrollDeductionCategories'

const pageSize = 10
const dateLabel = (date: string) => date.split('-').reverse().join('/')
const timeLabel = (value: string) => `${dateLabel(value.slice(0, 10))} ${value.slice(11, 19)}`

export default function PayrollNoveltyModal({ detail, concepts, initial, busy, onClose, onSave }: {
  detail: PayrollDetail
  concepts: Concept[]
  initial?: PayrollLine
  busy: boolean
  onClose: () => void
  onSave: (state: PayrollState) => Promise<void>
}) {
  const allConcepts = [...concepts, ...detail.parameter_snapshot.concepts.filter(item => !concepts.some(current => current.code === item.code))]
  const findConcept = (code: string) => allConcepts.find(item => item.code === code)
  const [editing, setEditing] = useState(initial)
  const [kind, setKind] = useState<'accrued' | 'deduction'>(initial?.kind ?? 'accrued')
  const [category, setCategory] = useState(() => payrollIncomeCategory(findConcept(initial?.concept ?? 'salary')))
  const [deductionCategory, setDeductionCategory] = useState(() => initial ? payrollDeductionCategory(findConcept(initial.concept)) : 'Seguridad social')
  const [socialAmounts, setSocialAmounts] = useState<Record<PayrollSocialDeduction, string>>({
    eps: initial?.concept === 'eps' ? initial.amount : '',
    pension: initial?.concept === 'pension' ? initial.amount : '',
    solidarity: initial?.concept === 'solidarity' ? initial.amount : '',
  })
  const [fspPercentage, setFspPercentage] = useState(initial?.concept === 'solidarity' ? initial.percentage ?? '' : '')
  const [code, setCode] = useState(initial?.concept ?? '')
  const [quantity, setQuantity] = useState(initial?.quantity ?? '')
  const [salaryDays, setSalaryDays] = useState(initial?.concept === 'salary' ? initial.quantity : detail.state.workedDays)
  const [amount, setAmount] = useState(initial?.amount ?? '')
  const [percentage, setPercentage] = useState(initial?.percentage ?? '')
  const [paymentNS, setPaymentNS] = useState(initial?.paymentNS ?? '')
  const [interestPayment, setInterestPayment] = useState(initial?.interestPayment ?? '')
  const [disabilityType, setDisabilityType] = useState<number | ''>(initial?.type ?? '')
  const [startDate, setStartDate] = useState(initial?.startDate ?? detail.state.startDate)
  const [endDate, setEndDate] = useState(initial?.endDate ?? detail.state.endDate)
  const [nonWorkingDays, setNonWorkingDays] = useState(initial?.nonWorkingDays ?? '0')
  const [startTime, setStartTime] = useState(initial?.startTime ?? '')
  const [endTime, setEndTime] = useState(initial?.endTime ?? '')
  const [overtimeOptions, setOvertimeOptions] = useState<{ id: number; name: string; code?: string | null }[]>([])
  const [selectedOvertimeSurchargeId, setSelectedOvertimeSurchargeId] = useState<number | ''>(initial?.overtimeSurchargeId ?? '')
  const [overtimeError, setOvertimeError] = useState('')
  const [overtimeAttempt, setOvertimeAttempt] = useState(0)
  const allowanceChoices = concepts.filter(item => item.active && item.kind === 'accrued' && isPayrollSalaryAllowance(item))
  const [allowanceCode, setAllowanceCode] = useState(allowanceChoices[0]?.code ?? '')
  const [allowanceQuantity, setAllowanceQuantity] = useState('')
  const [allowanceAmount, setAllowanceAmount] = useState('')
  const [page, setPage] = useState(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const submitting = useRef(false)
  const draftIds = useRef<string[]>([])
  const locked = busy || saving
  const salaryRows = kind === 'accrued' && category === 'Salario' && !editing
  const fixedSalary = kind === 'accrued' && category === 'Salario' && (!editing || editing.concept === 'salary')
  const selectedCode = fixedSalary ? 'salary' : code
  const concept = fixedSalary
    ? concepts.find(item => item.code === 'salary' && item.active) ?? (editing?.concept === 'salary' ? findConcept('salary') : undefined)
    : findConcept(code)
  const socialRows = kind === 'deduction' && deductionCategory === 'Seguridad social'
  const choices = concepts.filter(item => item.active && item.kind === kind &&
    (kind === 'deduction' ? payrollDeductionCategory(item) === deductionCategory : payrollIncomeCategory(item) === category) &&
    (!salaryRows || !isPayrollSalaryAllowance(item)))
  const dated = kind === 'accrued' ? ['Vacaciones', 'Incapacidades', 'Licencias remuneradas'].includes(category) : deductionCategory === 'Licencias no remuneradas'
  const overtimeCode = concept ? concept.code.startsWith('internal_') ? concept.category : concept.code : ''
  const overtime = isPayrollOvertime({ concept: overtimeCode })
  const activeOvertimeMaster = overtimeOptions.find(row => row.id === selectedOvertimeSurchargeId) ?? null
  useEffect(() => {
    if (!overtime) return
    let active = true
    void payrollService.overtimeSurcharges().then(rows => {
      if (!active) return
      setOvertimeOptions(rows)
      setOvertimeError('')
      if (!selectedOvertimeSurchargeId && rows.length) {
        setSelectedOvertimeSurchargeId(rows[0].id)
      }
    }).catch(() => {
      if (active) setOvertimeError('No pudimos cargar los recargos. Inténtalo de nuevo o comunícate con soporte.')
    })
    return () => { active = false }
  }, [overtime, overtimeAttempt])
  const vacation = kind === 'accrued' && category === 'Vacaciones'
  let vacationDays = ''
  if (vacation) {
    try { vacationDays = payrollNoveltyDateQuantity(startDate, endDate, nonWorkingDays) } catch { /* Mostrar el cálculo cuando el rango y los días sean válidos. */ }
  }
  const selectedQuantity = fixedSalary ? salaryDays : quantity
  const dateBounds = payrollNoveltyDateBounds(detail.state.period)
  const currentPage = Math.min(page, Math.max(1, Math.ceil(detail.state.lines.length / pageSize)))
  const rows = detail.state.lines.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const resetForm = () => {
    draftIds.current = []
    setEditing(undefined)
    setCode('')
    setSelectedOvertimeSurchargeId('')
    setQuantity('')
    setSalaryDays(detail.state.workedDays)
    setAmount('')
    setPercentage('')
    setPaymentNS('')
    setInterestPayment('')
    setDisabilityType('')
    setSocialAmounts({ eps: '', pension: '', solidarity: '' })
    setFspPercentage('')
    setAllowanceQuantity('')
    setAllowanceAmount('')
    setStartDate(detail.state.startDate)
    setEndDate(detail.state.endDate)
    setNonWorkingDays('0')
    setStartTime('')
    setEndTime('')
    setError('')
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (locked || submitting.current) return
    submitting.current = true
    setSaving(true)
    setError('')
    try {
      let next = detail.state
      const entries: { concept: Concept; quantity: string; amount: string; primary: boolean; percentage?: string }[] = []
      if (socialRows) {
        for (const social of payrollSocialDeductions) {
          const socialAmount = socialAmounts[social.code]
          if (!socialAmount) continue
          const configured = concepts.find(item => item.code === social.code && item.active && item.kind === 'deduction') ??
            (editing?.concept === social.code ? findConcept(social.code) : undefined)
          if (!configured) throw new Error(`Selecciona un concepto activo para ${social.label.toLowerCase()}.`)
          if (social.code === 'solidarity' && !fspPercentage) throw new Error('Ingresa el porcentaje FSP del fondo de solidaridad pensional.')
          entries.push({ concept: configured, quantity: editing?.concept === social.code ? editing.quantity : '1', amount: socialAmount,
            primary: editing?.concept === social.code, percentage: social.code === 'solidarity' ? fspPercentage : editing?.concept === social.code ? editing.percentage : undefined })
        }
      } else if (concept && (!fixedSalary || amount)) entries.push({ concept, quantity: dated ? payrollNoveltyDateQuantity(startDate, endDate, vacation ? nonWorkingDays : '0') : selectedQuantity, amount, primary: true })
      else if (quantity || amount) throw new Error('Selecciona el tipo de ingreso o deducción.')
      if (salaryRows && (allowanceQuantity || allowanceAmount)) {
        const allowance = findConcept(allowanceCode)
        if (!allowance) throw new Error('Selecciona el tipo de auxilio.')
        entries.push({ concept: allowance, quantity: allowanceQuantity, amount: allowanceAmount, primary: false })
      }
      if (!entries.length) throw new Error('Ingresa al menos una novedad antes de agregar.')
      for (const [index, entry] of entries.entries()) {
        const line = payrollNoveltyLine(next, entry.concept, {
          id: entry.primary && editing ? editing.id : (draftIds.current[index] ??= crypto.randomUUID()),
          quantity: entry.quantity,
          amount: entry.amount,
          percentage: entry.percentage ?? (entry.primary ? percentage || entry.concept.percentage || '0' : '0'),
          paymentNS: code === 'service_bonus' ? paymentNS : undefined,
          interestPayment: code === 'severance' ? interestPayment : undefined,
          type: code === 'disability' ? Number(disabilityType) || undefined : undefined,
          manual: true,
          ...(dated ? { startDate, endDate } : {}),
          ...(vacation ? { nonWorkingDays } : {}),
          ...(overtime ? { startTime, endTime, overtimeSurchargeId: Number(selectedOvertimeSurchargeId) || undefined } : {}),
        })
        next = { ...next, lines: next.lines.some(item => item.id === line.id)
          ? next.lines.map(item => item.id === line.id ? line : item)
          : [...next.lines, line], ...(line.concept === 'salary' ? { workedDays: line.quantity } : {}) }
      }
      await onSave(next)
      setPage(Math.ceil(next.lines.length / pageSize))
      resetForm()
      setSalaryDays(next.workedDays)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar la novedad.')
    } finally {
      submitting.current = false
      setSaving(false)
    }
  }
  const editLine = (line: PayrollLine) => {
    resetForm()
    setEditing(line)
    setKind(line.kind)
    setCategory(payrollIncomeCategory(findConcept(line.concept)))
    setDeductionCategory(payrollDeductionCategory(findConcept(line.concept)))
    if (line.kind === 'deduction' && payrollSocialDeductions.some(item => item.code === line.concept)) {
      setSocialAmounts(current => ({ ...current, [line.concept]: line.amount }))
      if (line.concept === 'solidarity') setFspPercentage(line.percentage ?? '')
    }
    setCode(line.concept)
    setSelectedOvertimeSurchargeId(line.overtimeSurchargeId ?? '')
    setQuantity(line.quantity)
    if (line.concept === 'salary') setSalaryDays(line.quantity)
    setAmount(line.amount)
    setPercentage(line.percentage ?? '')
    setPaymentNS(line.paymentNS ?? '')
    setInterestPayment(line.interestPayment ?? '')
    setDisabilityType(line.type ?? '')
    setStartDate(line.startDate ?? detail.state.startDate)
    setEndDate(line.endDate ?? detail.state.endDate)
    setNonWorkingDays(line.nonWorkingDays ?? '0')
    setStartTime(line.startTime ?? '')
    setEndTime(line.endTime ?? '')
  }
  const removeLine = async (line: PayrollLine) => {
    if (locked || submitting.current) return
    submitting.current = true
    setSaving(true)
    setError('')
    try {
      const next = { ...detail.state, lines: detail.state.lines.filter(item => item.id !== line.id) }
      const errors = validatePayroll(next, detail.employee_snapshot)
      if (errors.length) throw new Error(errors.join(' '))
      await onSave(next)
      if (editing?.id === line.id) resetForm()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo eliminar la novedad.')
    } finally {
      submitting.current = false
      setSaving(false)
    }
  }
  return <Modal
    title="Registrar novedades de nómina"
    subtitle={`Ingresa los ingresos, deducciones y novedades de ${employeeName(detail.employee_snapshot)}.`}
    className="payroll__novelty-modal"
    onClose={() => { if (!locked) onClose() }}
  >
    <form onSubmit={event => void submit(event)}>
      <div className="payroll__novelty-tabs" role="group" aria-label="Tipo de novedad">
        {(['accrued', 'deduction'] as const).map(value => <button key={value} type="button" className="payroll__button" aria-pressed={kind === value} disabled={locked} onClick={() => { resetForm(); setKind(value) }}>
          {value === 'accrued' ? 'Ingresos' : 'Deducciones'}
        </button>)}
      </div>
      {kind === 'accrued' && <div className="payroll__income-categories" role="group" aria-label="Categoría de ingreso">
        {payrollIncomeCategories.map(value => <button key={value} type="button" aria-pressed={category === value} disabled={locked} onClick={() => { resetForm(); setCategory(value) }}>{value}</button>)}
      </div>}
      {kind === 'deduction' && <div className="payroll__income-categories" role="group" aria-label="Categoría de deducción">
        {payrollDeductionCategories.map(value => <button key={value} type="button" aria-pressed={deductionCategory === value} disabled={locked} onClick={() => { resetForm(); setDeductionCategory(value) }}>{value}</button>)}
      </div>}
      {socialRows ? <div className="payroll__social-fields">
        {payrollSocialDeductions.map(social => {
          const available = concepts.some(item => item.code === social.code && item.kind === 'deduction' && item.active) || editing?.concept === social.code
          return <Field key={social.code} label={social.label}>
            <span className="payroll__social-value-label">Valor</span>
            <PayrollMoneyInput aria-label={social.label} placeholder="Ingresa el valor" value={socialAmounts[social.code]} disabled={locked || !available} onValueChange={value => setSocialAmounts(current => ({ ...current, [social.code]: value }))} />
          </Field>
        })}
        <Field label="Porcentaje FSP (%)"><input aria-label="Porcentaje FSP (%)" type="number" min="0" max="100" step="0.01" placeholder="Ingresa el porcentaje" value={fspPercentage} disabled={locked || !concepts.some(item => item.code === 'solidarity' && item.active && item.kind === 'deduction') && editing?.concept !== 'solidarity'} onChange={event => setFspPercentage(event.target.value)} /></Field>
      </div> : <div className={`payroll__income-fields${dated ? ' payroll__income-fields--dated' : ''}`}>
        <Field label={kind === 'accrued' ? 'Tipo de ingreso' : 'Tipo de deducción'}>
          {fixedSalary ? <input aria-label="Tipo de ingreso" value="Salario básico" readOnly /> : <select aria-label={kind === 'accrued' ? 'Tipo de ingreso' : 'Tipo de deducción'} value={selectedCode} disabled={locked} onChange={event => { setCode(event.target.value); setAmount(''); setPercentage('') }}>
            <option value="">Selecciona el concepto</option>
            {choices.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}
            {concept && !choices.some(item => item.code === code) && <option value={code}>{concept.name}</option>}
          </select>}
        </Field>
        {!dated && <Field label={category === 'Horas extras' && kind === 'accrued' ? 'Horas' : 'Días'}>
          <input aria-label="Cantidad de la novedad" type="number" min="0.01" max={fixedSalary ? '31' : undefined} step="0.01" placeholder="Ingresa la cantidad" value={selectedQuantity} disabled={locked} onChange={event => fixedSalary ? setSalaryDays(event.target.value) : setQuantity(event.target.value)} />
        </Field>}
        <Field label={code === 'severance' ? 'Valor de las cesantías' : 'Valor'}>
          <PayrollMoneyInput aria-label="Valor de la novedad" placeholder={code === 'severance' ? 'Ingresa el valor de las cesantías' : 'Ingresa el valor'} value={amount} disabled={locked} onValueChange={setAmount} />
        </Field>
        {code === 'service_bonus' && <Field label="Valor no salarial">
          <PayrollMoneyInput aria-label="Valor no salarial" placeholder="Ingresa el valor no salarial" value={paymentNS} disabled={locked} onValueChange={setPaymentNS} />
        </Field>}
        {code === 'severance' && <>
          <Field label="Porcentaje de intereses">
            <input aria-label="Porcentaje de intereses" type="number" min="0" max="100" step="0.01" placeholder="Ingresa el porcentaje" value={percentage} disabled={locked} onChange={event => setPercentage(event.target.value)} />
          </Field>
          <Field label="Valor de los intereses de cesantías">
            <PayrollMoneyInput aria-label="Valor de los intereses de cesantías" placeholder="Ingresa los intereses" value={interestPayment} disabled={locked} onValueChange={setInterestPayment} />
          </Field>
        </>}
        {code === 'disability' && <Field label="Tipo de incapacidad">
          <input aria-label="Tipo de incapacidad" type="number" min="1" step="1" placeholder="Ingresa el tipo" value={disabilityType} disabled={locked} onChange={event => setDisabilityType(event.target.value === '' ? '' : Number(event.target.value))} />
        </Field>}
        {salaryRows && allowanceChoices.length > 0 && <>
          <label className="payroll__allowance-field"><span className="payroll__sr-only">Tipo de auxilio</span>
            <select aria-label="Tipo de auxilio" value={allowanceCode} disabled={locked} onChange={event => setAllowanceCode(event.target.value)}>
              {allowanceChoices.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}
            </select>
          </label>
          <label><span className="payroll__mobile-field-label">Días del auxilio</span><input aria-label="Días del auxilio" type="number" min="0.01" step="0.01" placeholder="Ingresa la cantidad" value={allowanceQuantity} disabled={locked} onChange={event => setAllowanceQuantity(event.target.value)} /></label>
          <label><span className="payroll__mobile-field-label">Valor del auxilio</span><PayrollMoneyInput aria-label="Valor del auxilio" placeholder="Ingresa el valor" value={allowanceAmount} disabled={locked} onValueChange={setAllowanceAmount} /></label>
        </>}
      </div>}
      {(dated || kind === 'deduction' && !socialRows) && <div className={`payroll__grid${vacation ? '' : ' payroll__grid--two'} payroll__novelty-extra`}>
        {kind === 'deduction' && !socialRows && <Field label="Porcentaje"><input type="number" min="0" max="100" step="0.01" value={percentage || concept?.percentage || ''} disabled={locked} onChange={event => setPercentage(event.target.value)} /></Field>}
        {dated && <><Field label="Fecha inicio"><input type="date" required min={dateBounds.min} max={dateBounds.max} value={startDate} disabled={locked} onChange={event => setStartDate(event.target.value)} /></Field><Field label="Fecha fin"><input type="date" required min={startDate >= dateBounds.min && startDate <= dateBounds.max ? startDate : dateBounds.min} max={dateBounds.max} value={endDate} disabled={locked} onChange={event => setEndDate(event.target.value)} /></Field></>}
        {vacation && <Field label="Días no hábiles"><input aria-label="Días no hábiles" type="number" required min="0" step="1" value={nonWorkingDays} disabled={locked} onChange={event => setNonWorkingDays(event.target.value)} /></Field>}
      </div>}
      {vacation && <p role="status" className="payroll__muted">{vacationDays ? `Días de vacaciones: ${vacationDays}` : 'Revisa las fechas y los días no hábiles para calcular los días de vacaciones.'}</p>}
      {overtime && <div className="payroll__grid payroll__novelty-extra">
        <Field label="Tipo de recargo de horas extra">
          <select aria-label="Tipo de recargo de horas extra" value={selectedOvertimeSurchargeId} disabled={locked || overtimeOptions.length === 0} onChange={event => setSelectedOvertimeSurchargeId(event.target.value === '' ? '' : Number(event.target.value))}>
            <option value="">Selecciona un recargo</option>
            {overtimeOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
          </select>
        </Field>
        <Field label="Fecha y hora de inicio"><input aria-label="Fecha y hora de inicio" type="datetime-local" required step="1" min={`${dateBounds.min}T00:00:00`} max={`${dateBounds.max}T23:59:59`} value={startTime} disabled={locked} onChange={event => setStartTime(event.target.value.length === 16 ? `${event.target.value}:00` : event.target.value)} /></Field>
        <Field label="Fecha y hora de fin"><input aria-label="Fecha y hora de fin" type="datetime-local" required step="1" min={startTime || `${dateBounds.min}T00:00:00`} max={`${dateBounds.max}T23:59:59`} value={endTime} disabled={locked} onChange={event => setEndTime(event.target.value.length === 16 ? `${event.target.value}:00` : event.target.value)} /></Field>
        <Field label="Recargo"><input aria-label="Recargo" readOnly value={overtimeError ? 'Recargo no disponible' : activeOvertimeMaster?.name ?? 'Cargando recargo…'} /></Field>
        {overtimeError && <p role="alert">{overtimeError} <button type="button" className="payroll__link" onClick={() => setOvertimeAttempt(value => value + 1)}>Reintentar</button></p>}
      </div>}
      {!choices.length && !editing && !(salaryRows && allowanceChoices.length) && <p className="payroll__muted">No hay conceptos activos en esta categoría. Puedes agregarlos en la configuración de nómina.</p>}
      {error && <p className="payroll__notice payroll__notice--error" role="alert">{error}</p>}
      <div className="payroll__toolbar payroll__novelty-actions">
        {editing && <button type="button" className="payroll__button" disabled={locked} onClick={resetForm}>Cancelar edición</button>}
        <button className="payroll__button payroll__button--primary" disabled={locked || overtime && (!selectedOvertimeSurchargeId || Boolean(overtimeError)) || socialRows && !Object.values(socialAmounts).some(value => Number(value) > 0)}>{saving ? 'Guardando…' : editing ? 'Guardar cambios' : '+ Agregar'}</button>
      </div>
    </form>
    <section className="payroll__novelty-added" aria-label="Lista de novedades">
      <h3>Lista de novedades</h3>
      <div className="payroll__scroll payroll__novelty-list">
        <table>
          <thead><tr><th>Novedad</th><th>Período</th><th>Cantidad</th><th>Valor ingreso</th><th>Valor deducción</th><th>Acciones</th></tr></thead>
          <tbody>
            {!detail.state.lines.length && <tr><td colSpan={6} className="payroll__empty">Aún no hay novedades registradas</td></tr>}
            {rows.map(line => <tr key={line.id}>
              <td>{findConcept(line.concept)?.name ?? line.concept}</td>
              <td>{line.startTime && line.endTime ? `${timeLabel(line.startTime)} – ${timeLabel(line.endTime)}` : `${dateLabel(line.startDate ?? detail.state.startDate)} – ${dateLabel(line.endDate ?? detail.state.endDate)}`}</td>
              <td>{line.quantity}</td>
              <td>{line.kind === 'accrued' ? currency(line.amount) : '—'}</td>
              <td>{line.kind === 'deduction' ? currency(line.amount) : '—'}</td>
              <td><div className="payroll__toolbar"><button type="button" className="payroll__link" disabled={locked} onClick={() => editLine(line)}>Editar</button><button type="button" className="payroll__link" disabled={locked} onClick={() => void removeLine(line)}>Eliminar</button></div></td>
            </tr>)}
          </tbody>
        </table>
      </div>
      {shouldShowTablePagination(detail.state.lines.length, pageSize) && <nav className="payroll__pagination" aria-label="Páginas de novedades">
        <button type="button" className="payroll__button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Anterior</button>
        <span>{currentPage} / {Math.ceil(detail.state.lines.length / pageSize)}</span>
        <button type="button" className="payroll__button" disabled={currentPage * pageSize >= detail.state.lines.length} onClick={() => setPage(currentPage + 1)}>Siguiente</button>
      </nav>}
    </section>
  </Modal>
}
