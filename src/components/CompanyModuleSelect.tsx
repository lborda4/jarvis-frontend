import { JARVIS_MODULES, JARVIS_MODULE_LABELS, type JarvisModule } from '../types/companyModules'

export default function CompanyModuleSelect({ value, onChange, disabled = false }: {
  value: JarvisModule[]
  onChange: (modules: JarvisModule[]) => void
  disabled?: boolean
}) {
  return <fieldset className="admin-form__integrations" disabled={disabled}>
    <legend>Módulos de Jarvis</legend>
    {JARVIS_MODULES.map(module => <label className="admin-form__checkbox" key={module}>
      <input type="checkbox" checked={value.includes(module)} onChange={event => onChange(event.target.checked ? [...value, module] : value.filter(item => item !== module))} />
      {JARVIS_MODULE_LABELS[module]}
    </label>)}
    {!value.length && <span role="alert">Selecciona al menos un módulo.</span>}
  </fieldset>
}
