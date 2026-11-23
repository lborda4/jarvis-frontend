import { useEffect, useRef, useState } from 'react'
import Modal from './Modal'
import Button from './Button'
import { buildWhatsappHref } from '../constants/contact'
import { estimateBillingPlan, buildManualBillingPlan, billingEstimateMessage, type BillingEstimate, type BillingFrequency, type BillingRegistration } from '../marketing/billingSimulator'
import { BILLING_TOP_UPS, PAYROLL_TOP_UPS, PAYROLL_PLAN, COMPLIANCE_COMBOS } from '../marketing/catalog'
import { buildManualPayrollPlan, estimatePayrollPlan, payrollEstimateMessage, type PayrollEstimate, type PayrollPlanSelection } from '../marketing/payrollSimulator'
import { buildManualComboPlan, estimateComboPlan, comboEstimateMessage, type ComboEstimate } from '../marketing/comboSimulator'
import './BillingPlanSimulator.css'

const money = (amount: number) => `$${amount.toLocaleString('es-CO')} COP`
export function BillingEstimateResult({ estimate, manual = false }: { estimate: BillingEstimate; manual?: boolean }) {
  return <section className="billing-simulator__result" aria-label={manual ? 'Tu plan seleccionado' : 'Plan recomendado'} aria-live="polite" aria-atomic="true">
    <span className="billing-simulator__eyebrow">{manual ? 'Tu combinación' : 'Tu combinación recomendada'}</span>
    <h3>{estimate.planName}</h3>
    {!manual && <p className="billing-simulator__volume">Para {estimate.annualDocuments.toLocaleString('es-CO')} facturas al año</p>}
    <dl className="billing-simulator__breakdown"><div><dt>{estimate.unlimited ? 'Plan anual ilimitado' : `Plan anual · ${estimate.includedDocuments} documentos incluidos`}</dt><dd>{money(estimate.planAmount)}</dd></div>
      {estimate.packs.map(pack => <div key={pack.documents}><dt>{pack.quantity} × recarga de {pack.documents} documentos</dt><dd>{money(pack.amount * pack.quantity)}</dd></div>)}
    </dl>
    {estimate.unlimited ? <p className="billing-simulator__benefit">Te sale más económico el ilimitado. También incluye nómina.</p> : <p className="billing-simulator__benefit">{estimate.capacity?.toLocaleString('es-CO')} documentos en total{!manual && estimate.capacity! > estimate.annualDocuments ? ` · ${(estimate.capacity! - estimate.annualDocuments).toLocaleString('es-CO')} de margen` : ''}{!estimate.packs.length ? manual ? ' · Sin recargas' : ' · No necesitas recargas' : ''}</p>}
    <div className="billing-simulator__total"><span>Pago anual estimado</span><strong>{money(estimate.totalAmount)}</strong></div>
    <small>Las recargas vencen con la suscripción.</small>
  </section>
}

export function BillingManualPacks({ quantities, onChange, payroll = false, title = 'Elige tus recargas' }: { title?: string; quantities: Record<number, string>; onChange: (documents: number, quantity: string) => void; payroll?: boolean }) {
  const unit = payroll ? 'empleados' : 'documentos'
  const options = payroll ? PAYROLL_TOP_UPS.map(pack => ({ ...pack, documents: pack.employees })) : BILLING_TOP_UPS
  const [order, setOrder] = useState<number[]>(() => Object.keys(quantities).map(Number))
  const picker = useRef<HTMLSelectElement>(null)
  const selected = options.filter(pack => quantities[pack.documents] !== undefined && quantities[pack.documents] !== '0')
  const ordered = [...order.filter(count => selected.some(pack => pack.documents === count)), ...selected.filter(pack => !order.includes(pack.documents)).map(pack => pack.documents)]
  const available = options.filter(pack => !selected.includes(pack))
  const prefix = payroll ? 'payroll' : 'billing'
  const label = (count: number) => `${count} ${payroll && count === 1 ? 'empleado' : unit}`
  return <fieldset className="billing-simulator__packs"><legend>{title}</legend>
    {ordered.map(count => {
      return <div key={count} className="billing-simulator__pack">
        <select aria-label={`Recarga de ${label(count)}`} value={count} onChange={event => {
          const next = Number(event.target.value)
          setOrder(ordered.map(item => item === count ? next : item))
          onChange(count, '0'); onChange(next, quantities[count])
        }}>{options.filter(item => item.documents === count || available.includes(item)).map(item => <option key={item.documents} value={item.documents}>{label(item.documents)} · {money(item.amount)}</option>)}</select>
        <div className="billing-simulator__pack-actions">
          <input id={`${prefix}-pack-${count}`} aria-label={`Cantidad de recargas de ${count} ${unit}`} type="number" inputMode="numeric" min="1" max="10000" step="1" value={quantities[count]} onChange={event => onChange(count, event.target.value)} />
          <Button variant="ghost" aria-label={`Quitar recarga de ${label(count)}`} onClick={() => {
            onChange(count, '0'); setOrder(ordered.filter(item => item !== count)); picker.current?.focus()
          }}>Quitar</Button>
        </div>
      </div>
    })}
    {available.length > 0 && <select ref={picker} aria-label={payroll ? 'Agregar recarga de nómina' : 'Agregar recarga de documentos'} value="" onChange={event => {
      const count = Number(event.target.value)
      if (!count) return
      setOrder([...ordered, count]); onChange(count, '1')
    }}><option value="">{selected.length ? '+ Agregar otra recarga' : 'Selecciona una recarga'}</option>{available.map(pack => <option key={pack.documents} value={pack.documents}>{label(pack.documents)} · {money(pack.amount)}</option>)}</select>}
  </fieldset>
}

export function PayrollEstimateResult({ estimate, manual }: { estimate: PayrollEstimate; manual: boolean }) {
  return <section className="billing-simulator__result" aria-label={manual ? 'Tu plan de nómina seleccionado' : 'Plan de nómina recomendado'} aria-live="polite" aria-atomic="true">
    <span className="billing-simulator__eyebrow">{manual ? 'Tu combinación' : 'Tu combinación recomendada'}</span>
    <h3>{estimate.planName}</h3>
    {!manual && <p className="billing-simulator__volume">Para {estimate.employees.toLocaleString('es-CO')} empleados</p>}
    <dl className="billing-simulator__breakdown"><div><dt>{estimate.unlimited ? 'Plan anual ilimitado' : `Plan anual · ${estimate.includedEmployees} empleados incluidos`}</dt><dd>{money(estimate.planAmount)}</dd></div>
      {estimate.packs.map(pack => <div key={pack.employees}><dt>{pack.quantity} × recarga de {pack.employees} empleados</dt><dd>{money(pack.amount * pack.quantity)}</dd></div>)}
    </dl>
    <p className="billing-simulator__benefit">{estimate.unlimited ? 'Nómina y facturación ilimitadas.' : `Cupo total: ${estimate.capacity?.toLocaleString('es-CO')} empleados`}</p>
    <div className="billing-simulator__total"><span>Pago anual estimado</span><strong>{money(estimate.totalAmount)}</strong></div>
    <small>Las recargas vencen con la suscripción.</small>
  </section>
}

export function ComboEstimateResult({ estimate, manual }: { estimate: ComboEstimate; manual: boolean }) {
  return <section className="billing-simulator__result" aria-label="Plan de facturación y nómina" aria-live="polite" aria-atomic="true">
    <span className="billing-simulator__eyebrow">{manual ? 'Tu combinación' : 'Tu combinación recomendada'}</span>
    <h3>{estimate.planName}</h3>
    <dl className="billing-simulator__breakdown"><div><dt>{estimate.unlimited ? 'Plan anual ilimitado' : 'Plan anual · 50 documentos + 2 empleados'}</dt><dd>{money(estimate.planAmount)}</dd></div>
      {estimate.billingPacks.map(pack => <div key={`documents-${pack.documents}`}><dt>{pack.quantity} × recarga de {pack.documents} documentos</dt><dd>{money(pack.amount * pack.quantity)}</dd></div>)}
      {estimate.payrollPacks.map(pack => <div key={`employees-${pack.employees}`}><dt>{pack.quantity} × recarga de {pack.employees} empleados</dt><dd>{money(pack.amount * pack.quantity)}</dd></div>)}
    </dl>
    <p className="billing-simulator__benefit">{estimate.unlimited ? 'Facturación y nómina ilimitadas.' : `${estimate.documents?.toLocaleString('es-CO')} documentos · ${estimate.employees?.toLocaleString('es-CO')} empleados`}</p>
    <div className="billing-simulator__total"><span>Pago anual estimado</span><strong>{money(estimate.totalAmount)}</strong></div>
    <small>Las recargas vencen con la suscripción.</small>
  </section>
}

function SimulatorDialog({ onClose }: { onClose: () => void }) {
  const [product, setProduct] = useState<'billing' | 'payroll' | 'combo'>('billing')
  const [employees, setEmployees] = useState('')
  const [payrollPacks, setPayrollPacks] = useState<Record<number, string>>({})
  const [payrollPlan, setPayrollPlan] = useState<PayrollPlanSelection>('basic')
  const payroll = product === 'payroll'
  const combined = product === 'combo'
  const [comboPlan, setComboPlan] = useState<PayrollPlanSelection>('basic')
  const [mode, setMode] = useState<'automatic' | 'manual'>('automatic')
  const [packs, setPacks] = useState<Record<number, string>>({})
  const [quantity, setQuantity] = useState('')
  const [frequency, setFrequency] = useState<BillingFrequency>('month')
  const [registration, setRegistration] = useState<BillingRegistration>('initial')
  const inputRef = useRef<HTMLInputElement>(null)
  const number = quantity.trim() ? Number(quantity) : NaN
  const automaticEstimate = estimateBillingPlan(number, frequency, registration)
  const manual = mode === 'manual'
  const estimate = manual ? buildManualBillingPlan(registration, Object.fromEntries(Object.entries(packs).map(([documents, value]) => [documents, value.trim() ? Number(value) : 0]))) : automaticEstimate
  const payrollEstimate = manual
    ? buildManualPayrollPlan(payrollPlan, Object.fromEntries(Object.entries(payrollPacks).map(([count, value]) => [count, value.trim() ? Number(value) : 0])))
    : estimatePayrollPlan(employees.trim() ? Number(employees) : NaN)
  const comboEstimate = manual ? buildManualComboPlan(comboPlan,
    Object.fromEntries(Object.entries(packs).map(([count, value]) => [count, value.trim() ? Number(value) : 0])),
    Object.fromEntries(Object.entries(payrollPacks).map(([count, value]) => [count, value.trim() ? Number(value) : 0])))
    : estimateComboPlan(number, frequency, employees.trim() ? Number(employees) : NaN)
  const selectedEstimate = combined ? comboEstimate : payroll ? payrollEstimate : estimate
  const contactMessage = combined && comboEstimate ? comboEstimateMessage(comboEstimate) : payroll && payrollEstimate ? payrollEstimateMessage(payrollEstimate, manual) : estimate ? billingEstimateMessage(estimate, number, frequency, manual) : ''
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'; inputRef.current?.focus()
    const dialog = inputRef.current?.closest('[role="dialog"]')
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !dialog) return
      const elements = [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input, select, a[href]')]
      const first = elements[0], last = elements.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    dialog?.addEventListener('keydown', trap as EventListener)
    return () => { document.body.style.overflow = previousOverflow; dialog?.removeEventListener('keydown', trap as EventListener) }
  }, [])
  return <Modal isOpen onClose={onClose} labelledBy="billing-simulator-title" size="lg" className="billing-simulator-dialog">
    <header className="billing-simulator__header"><span className="billing-simulator__eyebrow">Facturación y nómina electrónica</span><h2 id="billing-simulator-title">Arma tu plan a la medida</h2></header>
    <div className="billing-simulator__layout"><div className="billing-simulator__fields">
      <fieldset><legend>¿Qué necesitas?</legend><div className="billing-simulator__period billing-simulator__products">{([{ id: 'billing', label: 'Facturación' }, { id: 'payroll', label: 'Nómina' }, { id: 'combo', label: 'Facturación + Nómina' }] as const).map(item => <Button key={item.id} variant={product === item.id ? 'primary' : 'outline'} aria-pressed={product === item.id} onClick={() => setProduct(item.id)}>{item.label}</Button>)}</div></fieldset>
      <fieldset><legend>Arma tu plan</legend><div className="billing-simulator__period">{([{ id: 'automatic', label: 'Automático' }, { id: 'manual', label: 'Manual' }] as const).map(item => <Button key={item.id} variant={mode === item.id ? 'primary' : 'outline'} aria-pressed={mode === item.id} onClick={() => setMode(item.id)}>{item.label}</Button>)}</div></fieldset>
      {!manual && !payroll && <>
      <fieldset><legend>¿Cómo prefieres calcular?</legend><div className="billing-simulator__period">{([{ id: 'month', label: 'Al mes' }, { id: 'year', label: 'Al año' }] as const).map(item => <Button key={item.id} variant={frequency === item.id ? 'primary' : 'outline'} aria-pressed={frequency === item.id} onClick={() => setFrequency(item.id)}>{item.label}</Button>)}</div></fieldset>
      <label htmlFor="billing-simulator-quantity">¿Cuántas facturas haces {frequency === 'month' ? 'al mes' : 'al año'}?<input ref={inputRef} id="billing-simulator-quantity" type="number" inputMode="numeric" min="1" max="1000000000" step="1" value={quantity} onChange={event => setQuantity(event.target.value)} placeholder="Ej. 20" aria-invalid={Boolean(quantity && !estimate)} aria-describedby="billing-simulator-input-help" /></label>
      <small id="billing-simulator-input-help">{quantity && !estimate ? 'Ingresa una cantidad entera entre 1 y 1.000.000.000.' : frequency === 'month' && estimate ? `Equivale a ${estimate.annualDocuments.toLocaleString('es-CO')} facturas al año.` : 'Incluye tus documentos soporte si los emites.'}</small>
      </>}
      {!manual && (payroll || combined) && <>
        <label htmlFor="payroll-simulator-quantity">¿Cuántos empleados tienes?<input ref={payroll ? inputRef : undefined} id="payroll-simulator-quantity" type="number" inputMode="numeric" min="1" max="1000000000" step="1" value={employees} onChange={event => setEmployees(event.target.value)} placeholder="Ej. 5" aria-invalid={Boolean(employees && !payrollEstimate)} aria-describedby="payroll-simulator-help" /></label>
        <small id="payroll-simulator-help">{employees && !payrollEstimate ? 'Ingresa una cantidad entera entre 1 y 1.000.000.000.' : 'Cupo de empleados para tu suscripción anual.'}</small>
      </>}
      {!payroll && !combined && <label htmlFor="billing-simulator-registration">Tu inscripción<select id="billing-simulator-registration" value={registration} onChange={event => setRegistration(event.target.value as BillingRegistration)}><option value="initial">Primera inscripción · 50 documentos</option><option value="regular">Inscripción regular · 25 documentos</option></select></label>}
      {manual && !payroll && !combined && <BillingManualPacks quantities={packs} onChange={(documents, value) => setPacks(previous => ({ ...previous, [documents]: value }))} />}
      {payroll && manual && <>
        <label htmlFor="payroll-simulator-plan">Tu plan<select id="payroll-simulator-plan" value={payrollPlan} onChange={event => setPayrollPlan(event.target.value as PayrollPlanSelection)}>
          <option value="basic">Nómina básica · {PAYROLL_PLAN.price}/año · {PAYROLL_PLAN.employees} empleados</option>
          <option value="unlimited">Combo ilimitado · {COMPLIANCE_COMBOS[1].price}/año</option>
        </select></label>
        {payrollPlan === 'basic' && <BillingManualPacks payroll quantities={payrollPacks} onChange={(count, value) => setPayrollPacks(previous => ({ ...previous, [count]: value }))} />}
      </>}
      {combined && manual && <>
        <label htmlFor="combo-simulator-plan">Tu combo<select id="combo-simulator-plan" value={comboPlan} onChange={event => setComboPlan(event.target.value as PayrollPlanSelection)}>
          <option value="basic">Combo inicial · {COMPLIANCE_COMBOS[0].price}/año</option>
          <option value="unlimited">Combo ilimitado · {COMPLIANCE_COMBOS[1].price}/año</option>
        </select></label>
        {comboPlan === 'basic' && <>
          <BillingManualPacks title="Recargas de documentos" quantities={packs} onChange={(count, value) => setPacks(previous => ({ ...previous, [count]: value }))} />
          <BillingManualPacks payroll title="Recargas de nómina" quantities={payrollPacks} onChange={(count, value) => setPayrollPacks(previous => ({ ...previous, [count]: value }))} />
        </>}
      </>}
      {manual && !selectedEstimate && <small role="alert">Usa cantidades enteras entre 0 y 10.000.</small>}
    </div><div>{selectedEstimate ? combined && comboEstimate ? <ComboEstimateResult estimate={comboEstimate} manual={manual} /> : payroll && payrollEstimate ? <PayrollEstimateResult estimate={payrollEstimate} manual={manual} /> : estimate && <BillingEstimateResult estimate={estimate} manual={manual} /> : <div className="billing-simulator__empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="5" y="2" width="14" height="20" rx="2" /><path d="M8 6h8M8 11h2m4 0h2M8 15h2m4 0h2M8 19h2m4 0h2" /></svg><p>{manual ? 'Revisa las cantidades de tus recargas.' : 'Ingresa tu cantidad para ver el plan y las recargas.'}</p></div>}</div></div>
    {selectedEstimate && <a className="btn btn--primary btn--md billing-simulator__contact" href={buildWhatsappHref(contactMessage)} target="_blank" rel="noopener noreferrer">Quiero este plan · Hablar con un asesor</a>}
  </Modal>
}

export default function BillingPlanSimulator() {
  const [open, setOpen] = useState(false)
  return <>
    <Button id="billing-simulator-trigger" className="billing-simulator-trigger" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="5" y="2" width="14" height="20" rx="2" /><path d="M8 6h8M8 11h2m4 0h2M8 15h2m4 0h2M8 19h2m4 0h2" /></svg><span>Arma tu plan a la medida<small>Facturación y nómina</small></span></Button>
    {open && <SimulatorDialog onClose={() => { setOpen(false); document.getElementById('billing-simulator-trigger')?.focus() }} />}
  </>
}
