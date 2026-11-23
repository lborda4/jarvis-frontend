import Button from './Button'
import type { AdminJarvisTopUp, AdminPlan } from '../types/admin'
import { formatCop, isTopUpCompatible } from '../utils/adminPlan'
import './CreateCompanyForm.css'

export default function JarvisTopUpSelect({ plan, catalog, value, onChange, disabled, idPrefix, compact = false }: {
  plan: AdminPlan | undefined | null
  catalog: AdminJarvisTopUp[]
  value: string[]
  onChange: (codes: string[]) => void
  disabled?: boolean
  compact?: boolean
  idPrefix: string
}) {
  const available = catalog.filter(item => isTopUpCompatible(plan, item))
  if (!plan) return null
  if (compact) {
    const selected = available.filter(item => value.includes(item.code))
    const remaining = available.filter(item => !value.includes(item.code))
    return <div className="company-topups-picker"><label className="admin-form__field" htmlFor={idPrefix}>Agregar una recarga<select id={idPrefix} value="" disabled={disabled || !remaining.length} onChange={event => { if (event.target.value) onChange([...value, event.target.value]) }}><option value="">{remaining.length ? 'Selecciona una recarga' : 'Todas las recargas agregadas'}</option>{(['DOCUMENTS', 'PAYROLL_EMPLOYEES'] as const).map(kind => <optgroup key={kind} label={kind === 'DOCUMENTS' ? 'Documentos' : 'Nómina'}>{remaining.filter(item => item.kind === kind).map(item => <option key={item.code} value={item.code}>{item.name} · {formatCop(item.priceCop)}</option>)}</optgroup>)}</select></label>
      <div className="company-topups-picker__list">{selected.map(item => <div className="company-topups-picker__item" key={item.code}><span><strong>{item.name}</strong><small>{formatCop(item.priceCop)}</small></span><Button variant="ghost" disabled={disabled} aria-label={'Quitar ' + item.name} onClick={() => onChange(value.filter(code => code !== item.code))}>Quitar</Button></div>)}</div>
      {!selected.length && <p className="company-create__hint">Puedes combinar varias recargas.</p>}
    </div>
  }
  return <>{(['DOCUMENTS', 'PAYROLL_EMPLOYEES'] as const).map(kind => {
    const options = available.filter(item => item.kind === kind)
    if (!options.length) return null
    const id = `${idPrefix}-${kind}`
    return <fieldset className="company-topups" key={kind} id={id} disabled={disabled}>
      <legend>{kind === 'DOCUMENTS' ? 'Recarga de documentos' : 'Recarga de nómina'}</legend>
      <div className="company-topups__options">{options.map(item => <label className="company-topups__option" key={item.code}>
        <input type="checkbox" value={item.code} checked={value.includes(item.code)} onChange={event => onChange(event.target.checked ? [...value, item.code] : value.filter(code => code !== item.code))} />
        <span>{item.name}<small>{formatCop(item.priceCop)}</small></span>
      </label>)}</div>
    </fieldset>
  })}</>
}
