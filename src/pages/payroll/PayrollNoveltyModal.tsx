import { useEffect, useRef, useState, type FormEvent } from 'react'
import { payrollService, type Concept, type PayrollDetail, type PayrollState } from '../../services/payrollService'
import { isPayrollOvertime } from '../../utils/payrollOvertime'
import { cents, money, payrollArrayDeductionKind, payrollScalarDeductionField, payrollStructuredDeductionKind, validatePayroll, type PayrollLine } from '../../utils/payrollDomain'
import { shouldShowTablePagination } from '../../utils/tablePagination'
import { payrollQuantity } from '../../utils/payrollQuantity'
import { payrollFixedLawDeductionId, payrollRequiredDeductionErrors } from '../../utils/payrollRequiredDeductions'
import { currency, employeeName } from './payrollDefaults'
import { Field, Modal } from './PayrollPage'
import PayrollMoneyInput from './PayrollMoneyInput'
import { payrollNoveltyDateBounds, payrollNoveltyDateQuantity, payrollNoveltyLine } from './payrollNoveltyDomain'
import { isPayrollSalaryAllowance, payrollIncomeCategories, payrollIncomeCategory } from './payrollIncomeCategories'
import { payrollDeductionCategories, payrollDeductionCategory, payrollSocialDeductions, type PayrollSocialDeduction } from './payrollDeductionCategories'
import { payrollSocialAmounts, payrollSocialCode } from './payrollSocialNovelties'
import { payrollNoveltyKey, replacePayrollNoveltyLine } from './payrollNoveltyEntries'

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
  const savedLine = (code: string, kind: PayrollLine['kind'], state = detail.state) =>
    state.lines.findLast(line => payrollNoveltyKey(line) === payrollNoveltyKey({ concept: code, kind }))
  const savedInitial = initial ?? savedLine('salary', 'accrued')
  const [editing, setEditing] = useState(initial)
  const [kind, setKind] = useState<'accrued' | 'deduction'>(initial?.kind ?? 'accrued')
  const [category, setCategory] = useState(() => payrollIncomeCategory(findConcept(initial?.concept ?? 'salary')))
  const [deductionCategory, setDeductionCategory] = useState(() => initial ? payrollDeductionCategory(findConcept(initial.concept)) : 'Seguridad social')
  const [socialAmounts, setSocialAmounts] = useState<Record<PayrollSocialDeduction, string>>(() =>
    payrollSocialAmounts(initial ? [...detail.state.lines, initial] : detail.state.lines))
  const [code, setCode] = useState(savedInitial?.concept ?? '')
  const [quantity, setQuantity] = useState(savedInitial?.quantity ?? '')
  const [salaryDays, setSalaryDays] = useState(savedInitial?.concept === 'salary' ? savedInitial.quantity : detail.state.workedDays)
  const [amount, setAmount] = useState(savedInitial?.amount ?? '')
  const [percentage, setPercentage] = useState(savedInitial?.percentage ?? '')
  const [description, setDescription] = useState(savedInitial?.description ?? '')
  const [publicSanction, setPublicSanction] = useState(savedInitial?.publicSanction ?? '')
  const [privateSanction, setPrivateSanction] = useState(savedInitial?.privateSanction ?? '')
  const [paymentNS, setPaymentNS] = useState(savedInitial?.paymentNS ?? '')
  const [interestPayment, setInterestPayment] = useState(savedInitial?.interestPayment ?? '')
  const [disabilityType, setDisabilityType] = useState<number | ''>(savedInitial?.type ?? '')
  const [disabilityOptions, setDisabilityOptions] = useState<{ id: number; name: string; code?: string | null }[]>([])
  const [disabilityLoading, setDisabilityLoading] = useState(false)
  const [disabilityError, setDisabilityError] = useState('')
  const [disabilityAttempt, setDisabilityAttempt] = useState(0)
  const [startDate, setStartDate] = useState(savedInitial?.startDate ?? detail.state.startDate)
  const [endDate, setEndDate] = useState(savedInitial?.endDate ?? detail.state.endDate)
  const [nonWorkingDays, setNonWorkingDays] = useState(savedInitial?.nonWorkingDays ?? '0')
  const [startTime, setStartTime] = useState(savedInitial?.startTime ?? '')
  const [endTime, setEndTime] = useState(savedInitial?.endTime ?? '')
  const [overtimeOptions, setOvertimeOptions] = useState<{ id: number; name: string; code?: string | null }[]>([])
  const [selectedOvertimeSurchargeId, setSelectedOvertimeSurchargeId] = useState<number | ''>(savedInitial?.overtimeSurchargeId ?? '')
  const [overtimeError, setOvertimeError] = useState('')
  const [overtimeAttempt, setOvertimeAttempt] = useState(0)
  const allowanceChoices = concepts.filter(item => item.active && item.kind === 'accrued' && isPayrollSalaryAllowance(item))
  const [allowanceCode, setAllowanceCode] = useState(allowanceChoices[0]?.code ?? '')
  const [allowanceQuantity, setAllowanceQuantity] = useState(savedLine(allowanceCode, 'accrued')?.quantity ?? '')
  const [allowanceAmount, setAllowanceAmount] = useState(savedLine(allowanceCode, 'accrued')?.amount ?? '')
  const [page, setPage] = useState(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [validationError, setValidationError] = useState(false)
  const submitting = useRef(false)
  const draftIds = useRef<string[]>([])
  const locked = busy || saving
  const fixedSalary = kind === 'accrued' && category === 'Salario' && (!code || code === 'salary')
  const salaryRows = fixedSalary
  const disability = kind === 'accrued' && category === 'Incapacidades'
  const selectedCode = fixedSalary ? 'salary' : disability ? 'disability' : code
  const concept = fixedSalary
    ? concepts.find(item => item.code === 'salary' && item.active) ?? (editing?.concept === 'salary' ? findConcept('salary') : undefined)
    : disability ? concepts.find(item => item.code === 'disability' && item.active && item.kind === 'accrued') ?? (editing?.concept === 'disability' ? findConcept('disability') : undefined) : findConcept(code)
  const availableDeductionCategories = payrollDeductionCategories.filter(value =>
    concepts.some(item => item.active && item.kind === 'deduction' && payrollDeductionCategory(item) === value) ||
    editing?.kind === 'deduction' && payrollDeductionCategory(findConcept(editing.concept)) === value)
  const activeDeductionCategory = availableDeductionCategories.includes(deductionCategory)
    ? deductionCategory : availableDeductionCategories[0] ?? 'Otras deducciones'
  const socialRows = kind === 'deduction' && activeDeductionCategory === 'Seguridad social'
  const requiredSocialEntry = (code: string) => ['eps', 'pension'].includes(code) &&
    payrollRequiredDeductionErrors({ ...detail.state, lines: detail.state.lines.filter(line => line.id !== editing?.id) })
      .some(error => error.includes(code === 'eps' ? 'EPS' : 'pensión'))
  const structuredDeduction = kind === 'deduction' && concept ? payrollStructuredDeductionKind(concept.code.startsWith('internal_') ? concept.category : concept.code) : undefined
  const deductionKey = concept?.code.startsWith('internal_') ? concept.category : concept?.code ?? ''
  const valueDeduction = kind === 'deduction' && Boolean(payrollArrayDeductionKind(deductionKey) || payrollScalarDeductionField(deductionKey))
  const otherDeduction = valueDeduction && payrollArrayDeductionKind(deductionKey) === 'other_deductions'
  const choices = concepts.filter(item => item.active && item.kind === kind &&
    (kind === 'deduction' ? payrollDeductionCategory(item) === activeDeductionCategory : payrollIncomeCategory(item) === category) &&
    (!salaryRows || !isPayrollSalaryAllowance(item)))
  const dated = kind === 'accrued' ? ['Vacaciones', 'Incapacidades', 'Licencias remuneradas'].includes(category) : activeDeductionCategory === 'Licencias no remuneradas'
  const overtimeCode = concept ? concept.code.startsWith('internal_') ? concept.category : concept.code : ''
  const overtime = isPayrollOvertime({ concept: overtimeCode })
  const activeOvertimeMaster = overtimeOptions.find(row => row.id === selectedOvertimeSurchargeId) ?? null
  useEffect(() => {
    if (!disability) return
    let active = true
    setDisabilityLoading(true)
    setDisabilityError('')
    setDisabilityOptions([])
    void payrollService.disabilityTypes().then(rows => {
      if (!active) return
      if (!rows.length) throw new Error('Catálogo vacío')
      setDisabilityOptions(rows)
    }).catch(() => {
      if (active) setDisabilityError('No pudimos cargar los tipos de incapacidad. Intenta nuevamente.')
    }).finally(() => { if (active) setDisabilityLoading(false) })
    return () => { active = false }
  }, [disability, disabilityAttempt])
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
  const quantityIsHours = category === 'Horas extras' && kind === 'accrued'
  const selectedQuantity = quantityIsHours ? quantity : payrollQuantity(fixedSalary ? salaryDays : quantity)
  const dateBounds = payrollNoveltyDateBounds(detail.state.period)
  const currentPage = Math.min(page, Math.max(1, Math.ceil(detail.state.lines.length / pageSize)))
  const rows = detail.state.lines.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const resetForm = (state = detail.state) => {
    draftIds.current = []
    setEditing(undefined)
    setCode('')
    setSelectedOvertimeSurchargeId('')
    setQuantity('')
    setSalaryDays(detail.state.workedDays)
    setAmount('')
    setPercentage('')
    setDescription('')
    setPublicSanction('')
    setPrivateSanction('')
    setPaymentNS('')
    setInterestPayment('')
    setDisabilityType('')
    setSocialAmounts(payrollSocialAmounts(state.lines))
    setAllowanceQuantity('')
    setAllowanceAmount('')
    setStartDate(detail.state.startDate)
    setEndDate(detail.state.endDate)
    setNonWorkingDays('0')
    setStartTime('')
    setEndTime('')
    setError('')
  }
  const prepareSubmission = (preview = false) => {
    if (disability && (disabilityLoading || disabilityError || !disabilityOptions.some(row => row.id === disabilityType)))
      throw new Error('Selecciona un tipo de incapacidad de la tabla maestra.')
    let next = detail.state
    if (structuredDeduction === 'labor_union' && percentage === '') throw new Error('Ingresa el porcentaje del aporte sindical.')
    const selectedAmount = structuredDeduction === 'sanctions' ? money(cents(publicSanction || '0') + cents(privateSanction || '0')) : amount
    const entries: { concept: Concept; quantity: string; amount: string; primary: boolean; percentage?: string; typeLawDeductionsId?: number }[] = []
    if (socialRows) {
      for (const social of payrollSocialDeductions) {
        const socialAmount = socialAmounts[social.code]
        const socialType = payrollFixedLawDeductionId(social.code)!
        if (socialAmount === '') {
          if (requiredSocialEntry(social.code)) throw new Error(`Completa el valor de ${social.label.toLowerCase()}.`)
          continue
        }
        const configured = concepts.find(item => item.code === social.code && item.active && item.kind === 'deduction') ??
          (editing?.concept === social.code ? findConcept(social.code) : undefined)
        if (!configured) throw new Error(`Selecciona un concepto activo para ${social.label.toLowerCase()}.`)
        entries.push({ concept: configured, quantity: editing?.concept === social.code ? editing.quantity : '1', amount: socialAmount,
          primary: editing?.concept === social.code, typeLawDeductionsId: Number(socialType) })
      }
    } else if (concept && (!fixedSalary || amount)) entries.push({ concept, quantity: structuredDeduction || valueDeduction ? '1' : dated ? payrollNoveltyDateQuantity(startDate, endDate, vacation ? nonWorkingDays : '0') : selectedQuantity, amount: selectedAmount, primary: true })
    else if (quantity || amount) throw new Error('Selecciona el tipo de ingreso o deducción.')
    if (salaryRows && (allowanceQuantity || allowanceAmount)) {
      const allowance = findConcept(allowanceCode)
      if (!allowance) throw new Error('Selecciona el tipo de auxilio.')
      entries.push({ concept: allowance, quantity: allowanceQuantity, amount: allowanceAmount, primary: false })
    }
    if (!entries.length) throw new Error('Ingresa al menos una novedad antes de agregar.')
    for (const [index, entry] of entries.entries()) {
      const existing = savedLine(entry.concept.code, entry.concept.kind, next)
      const id = entry.primary && editing ? editing.id : existing?.id ?? (preview ? `preview-${index}` : (draftIds.current[index] ??= crypto.randomUUID()))
      const key = payrollNoveltyKey({ concept: entry.concept.code, kind: entry.concept.kind })
      next = { ...next, lines: next.lines.filter(item => payrollNoveltyKey(item) !== key || item.id === id) }
      const line = payrollNoveltyLine(next, entry.concept, {
        id,
        quantity: entry.quantity,
        amount: entry.amount,
        percentage: structuredDeduction === 'labor_union' ? percentage : entry.percentage ?? (entry.primary ? percentage || entry.concept.percentage || '0' : '0'),
        ...(structuredDeduction === 'orders' || otherDeduction ? { description: description.trim() } : {}),
        ...(structuredDeduction === 'sanctions' ? { publicSanction, privateSanction } : {}),
        paymentNS: code === 'service_bonus' ? paymentNS : undefined,
        interestPayment: code === 'severance' ? interestPayment : undefined,
        type: disability ? Number(disabilityType) : undefined,
        typeLawDeductionsId: entry.typeLawDeductionsId,
        manual: true,
        ...(dated ? { startDate, endDate } : {}),
        ...(vacation ? { nonWorkingDays } : {}),
        ...(overtime ? { startTime, endTime, overtimeSurchargeId: Number(selectedOvertimeSurchargeId) || undefined } : {}),
      })
      next = { ...next, lines: replacePayrollNoveltyLine(next.lines, line), ...(line.concept === 'salary' ? { workedDays: line.quantity } : {}) }
    }
    return next
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (locked || submitting.current) return
    submitting.current = true
    setSaving(true)
    setError('')
    let preparing = true
    try {
      const next = prepareSubmission()
      preparing = false
      await onSave(next)
      setPage(Math.ceil(next.lines.length / pageSize))
      resetForm(next)
      if (!socialRows) {
        setCode(selectedCode)
        fillLine(savedLine(selectedCode, kind, next), next)
        fillAllowance(allowanceCode, next)
      }
      setSalaryDays(next.workedDays)
    } catch (cause) {
      setValidationError(preparing)
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar la novedad.')
    } finally {
      submitting.current = false
      setSaving(false)
    }
  }
  const fillLine = (line: PayrollLine | undefined, state = detail.state) => {
    setSelectedOvertimeSurchargeId(line?.overtimeSurchargeId ?? '')
    setQuantity(line?.quantity ?? '')
    setSalaryDays(line?.concept === 'salary' ? line.quantity : state.workedDays)
    setAmount(line?.amount ?? '')
    setPercentage(line?.percentage ?? '')
    setDescription(line?.description ?? '')
    setPublicSanction(line?.publicSanction ?? '')
    setPrivateSanction(line?.privateSanction ?? '')
    setPaymentNS(line?.paymentNS ?? '')
    setInterestPayment(line?.interestPayment ?? '')
    setDisabilityType(line?.type ?? '')
    setStartDate(line?.startDate ?? state.startDate)
    setEndDate(line?.endDate ?? state.endDate)
    setNonWorkingDays(line?.nonWorkingDays ?? '0')
    setStartTime(line?.startTime ?? '')
    setEndTime(line?.endTime ?? '')
  }
  const fillAllowance = (code: string, state = detail.state) => {
    const line = savedLine(code, 'accrued', state)
    setAllowanceQuantity(line?.quantity ?? '')
    setAllowanceAmount(line?.amount ?? '')
  }
  const chooseConcept = (code: string) => {
    resetForm()
    setCode(code)
    fillLine(savedLine(code, kind))
    fillAllowance(allowanceCode)
  }
  const chooseIncomeCategory = (value: typeof category) => {
    resetForm()
    setKind('accrued')
    setCategory(value)
    fillLine(savedLine(value === 'Salario' ? 'salary' : value === 'Incapacidades' ? 'disability' : '', 'accrued'))
    fillAllowance(allowanceCode)
  }
  const editLine = (line: PayrollLine) => {
    resetForm()
    setEditing(line)
    setKind(line.kind)
    setCategory(payrollIncomeCategory(findConcept(line.concept)))
    setDeductionCategory(payrollDeductionCategory(findConcept(line.concept)))
    const socialCode = payrollSocialCode(line)
    if (socialCode) setSocialAmounts(current => ({ ...current, [socialCode]: line.amount }))
    setCode(line.concept)
    fillLine(line)
  }
  const removeLine = async (line: PayrollLine) => {
    if (locked || submitting.current) return
    submitting.current = true
    setSaving(true)
    setError('')
    setValidationError(false)
    try {
      const next = { ...detail.state, lines: detail.state.lines.filter(item => item.id !== line.id) }
      const errors = validatePayroll(next, detail.employee_snapshot)
      if (errors.length) throw new Error(errors.join(' '))
      await onSave(next)
      if (editing?.id === line.id) resetForm(next)
      else {
        const socialCode = payrollSocialCode(line)
        if (socialCode) setSocialAmounts(current => ({ ...current, [socialCode]: payrollSocialAmounts(next.lines)[socialCode] }))
        else {
          if (payrollNoveltyKey(line) === payrollNoveltyKey({ concept: selectedCode, kind }))
            fillLine(savedLine(selectedCode, kind, next), next)
          fillAllowance(allowanceCode, next)
        }
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo eliminar la novedad.')
    } finally {
      submitting.current = false
      setSaving(false)
    }
  }
  // Recheck only an existing validation notice; saving errors remain until retry.
  let visibleError = error
  if (error && validationError) {
    try {
      prepareSubmission(true)
      visibleError = ''
    } catch (cause) {
      if (!(cause instanceof Error) || cause.message !== error) visibleError = ''
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
        {(['accrued', 'deduction'] as const).map(value => <button key={value} type="button" className="payroll__button" aria-pressed={kind === value} disabled={locked} onClick={() => { if (value === 'accrued') chooseIncomeCategory(category); else { resetForm(); setKind(value) } }}>
          {value === 'accrued' ? 'Ingresos' : 'Deducciones'}
        </button>)}
      </div>
      {kind === 'accrued' && <div className="payroll__income-categories" role="group" aria-label="Categoría de ingreso">
        {payrollIncomeCategories.map(value => <button key={value} type="button" aria-pressed={category === value} disabled={locked} onClick={() => chooseIncomeCategory(value)}>{value}</button>)}
      </div>}
      {kind === 'deduction' && <div className="payroll__income-categories" role="group" aria-label="Categoría de deducción">
        {availableDeductionCategories.map(value => <button key={value} type="button" aria-pressed={activeDeductionCategory === value} disabled={locked} onClick={() => { resetForm(); setDeductionCategory(value) }}>{value}</button>)}
      </div>}
      {socialRows && <p className="payroll__muted">Ingresa los valores de salud y pensión. Si el valor es cero, ingrésalo expresamente.</p>}
      {socialRows ? <div className="payroll__social-fields">
        {payrollSocialDeductions.map(social => {
          const available = concepts.some(item => item.code === social.code && item.kind === 'deduction' && item.active) || editing?.concept === social.code
          return <fieldset key={social.code} className="payroll__social-card" disabled={locked || !available}>
            <legend>{social.label}{['solidarity', 'subsistence'].includes(social.code) ? ' (opcional)' : ' *'}</legend>
            <PayrollMoneyInput aria-label={social.label} placeholder="Ingresa el valor" required={requiredSocialEntry(social.code)} value={socialAmounts[social.code]} onValueChange={value => setSocialAmounts(current => ({ ...current, [social.code]: value }))} />
          </fieldset>
        })}
      </div> : <div className={`payroll__income-fields${dated || valueDeduction && !otherDeduction ? ' payroll__income-fields--dated' : ''}`}>
        {disability ? <Field label="Tipo de incapacidad">
          <select aria-label="Tipo de incapacidad" required value={disabilityType} disabled={locked || disabilityLoading || Boolean(disabilityError)} onChange={event => setDisabilityType(event.target.value === '' ? '' : Number(event.target.value))}>
            <option value="">{disabilityLoading ? 'Cargando tipos de incapacidad…' : 'Selecciona el tipo de incapacidad'}</option>
            {disabilityOptions.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </Field> : <Field label={kind === 'accrued' ? 'Tipo de ingreso' : 'Tipo de deducción'}>
          {fixedSalary ? <input aria-label="Tipo de ingreso" value="Salario básico" readOnly /> : <select aria-label={kind === 'accrued' ? 'Tipo de ingreso' : 'Tipo de deducción'} value={selectedCode} disabled={locked} onChange={event => chooseConcept(event.target.value)}>
            <option value="">Selecciona el concepto</option>
            {choices.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}
            {concept && !choices.some(item => item.code === code) && <option value={code}>{concept.name}</option>}
          </select>}
        </Field>}
        {!dated && !structuredDeduction && !valueDeduction && <Field label={category === 'Horas extras' && kind === 'accrued' ? 'Horas' : 'Días'}>
          <input aria-label="Cantidad de la novedad" type="number" min={quantityIsHours ? '0.01' : '1'} max={fixedSalary ? '31' : undefined} step={quantityIsHours ? '0.01' : '1'} placeholder="Ingresa la cantidad" value={selectedQuantity} disabled={locked} onChange={event => fixedSalary ? setSalaryDays(event.target.value) : setQuantity(event.target.value)} />
        </Field>}
        {structuredDeduction === 'sanctions' ? <>
          <Field label="Sanción pública"><PayrollMoneyInput aria-label="Valor de la sanción pública" placeholder="Ingresa el valor" value={publicSanction} disabled={locked} onValueChange={setPublicSanction} /></Field>
          <Field label="Sanción privada"><PayrollMoneyInput aria-label="Valor de la sanción privada" placeholder="Ingresa el valor" value={privateSanction} disabled={locked} onValueChange={setPrivateSanction} /></Field>
        </> : <Field label={code === 'severance' ? 'Valor de las cesantías' : 'Valor'}>
          <PayrollMoneyInput aria-label="Valor de la novedad" placeholder={code === 'severance' ? 'Ingresa el valor de las cesantías' : 'Ingresa el valor'} value={amount} disabled={locked} onValueChange={setAmount} />
        </Field>}
        {structuredDeduction === 'labor_union' && <Field label="Porcentaje de aporte sindical (%)"><input aria-label="Porcentaje de aporte sindical" type="number" min="0" max="100" step="0.01" required value={percentage} disabled={locked} onChange={event => setPercentage(event.target.value)} /></Field>}
        {structuredDeduction === 'orders' && <Field label="Descripción de la libranza"><input aria-label="Descripción de la libranza" type="text" required placeholder="Describe la libranza" value={description} disabled={locked} onChange={event => setDescription(event.target.value)} /></Field>}
        {otherDeduction && <Field label="Descripción (opcional)"><input aria-label="Descripción de la deducción" type="text" placeholder="Describe la deducción" value={description} disabled={locked} onChange={event => setDescription(event.target.value)} /></Field>}
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
        {salaryRows && allowanceChoices.length > 0 && <>
          <label className="payroll__allowance-field"><span className="payroll__sr-only">Tipo de auxilio</span>
            <select aria-label="Tipo de auxilio" value={allowanceCode} disabled={locked} onChange={event => { setAllowanceCode(event.target.value); fillAllowance(event.target.value) }}>
              {allowanceChoices.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}
            </select>
          </label>
          <label><span className="payroll__mobile-field-label">Días del auxilio</span><input aria-label="Días del auxilio" type="number" min="1" step="1" placeholder="Ingresa la cantidad" value={payrollQuantity(allowanceQuantity)} disabled={locked} onChange={event => setAllowanceQuantity(event.target.value)} /></label>
          <label><span className="payroll__mobile-field-label">Valor del auxilio</span><PayrollMoneyInput aria-label="Valor del auxilio" placeholder="Ingresa el valor" value={allowanceAmount} disabled={locked} onValueChange={setAllowanceAmount} /></label>
        </>}
      </div>}
      {disability && disabilityError && <p className="payroll__notice payroll__notice--error" role="alert">{disabilityError} <button type="button" className="payroll__link" disabled={locked} onClick={() => setDisabilityAttempt(value => value + 1)}>Reintentar</button></p>}
      {(dated || kind === 'deduction' && !socialRows && !structuredDeduction && !valueDeduction) && <div className={`payroll__grid${vacation ? '' : ' payroll__grid--two'} payroll__novelty-extra`}>
        {kind === 'deduction' && !socialRows && !structuredDeduction && !valueDeduction && <Field label="Porcentaje"><input type="number" min="0" max="100" step="0.01" value={percentage || concept?.percentage || ''} disabled={locked} onChange={event => setPercentage(event.target.value)} /></Field>}
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
      {!choices.length && !editing && !(salaryRows && allowanceChoices.length) && <p className="payroll__muted">No hay conceptos activos en esta categoría.</p>}
      {visibleError && <p className="payroll__notice payroll__notice--error" role="alert">{visibleError}</p>}
      <div className="payroll__toolbar payroll__novelty-actions">
        {editing && <button type="button" className="payroll__button" disabled={locked} onClick={() => socialRows ? resetForm() : chooseConcept(selectedCode)}>Cancelar edición</button>}
        <button className="payroll__button payroll__button--primary" disabled={locked || disability && (disabilityLoading || Boolean(disabilityError) || !disabilityOptions.some(row => row.id === disabilityType)) || overtime && (!selectedOvertimeSurchargeId || Boolean(overtimeError)) || socialRows && !Object.values(socialAmounts).some(value => value !== '')}>{saving ? 'Guardando…' : editing || (socialRows ? detail.state.lines.some(line => payrollSocialCode(line)) : savedLine(selectedCode, kind) || salaryRows && savedLine(allowanceCode, 'accrued')) ? 'Guardar cambios' : '+ Agregar'}</button>
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
              <td>{payrollQuantity(line.quantity)}</td>
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
