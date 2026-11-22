import type { AdminJarvisTopUp, AdminPlan } from '../types/admin'
import { formatCop, isTopUpCompatible } from '../utils/adminPlan'
import './CreateCompanyForm.css'

export default function JarvisTopUpSelect({ plan, catalog, value, onChange, disabled, idPrefix }: {
  plan: AdminPlan | undefined | null
  catalog: AdminJarvisTopUp[]
  value: string[]
  onChange: (codes: string[]) => void
  disabled?: boolean
  idPrefix: string
}) {
  const available = catalog.filter(item => isTopUpCompatible(plan, item))
  if (!plan) return null
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
