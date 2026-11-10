import { useId, useRef, useState, type KeyboardEvent } from 'react'
import type { JarvisReportSuggestion } from '../services/jarvisReportsService'
import { filterReportOptions } from '../utils/reportFilterOptions'
import './ReportFilterCombobox.css'

interface Props {
  label: string
  value: string
  onChange: (value: string) => void
  options: JarvisReportSuggestion[]
  placeholder: string
  loading?: boolean
  failed?: boolean
}

/** Keeps typed filters usable even when the suggestions service is unavailable. */
export default function ReportFilterCombobox({ label, value, onChange, options, placeholder, loading, failed }: Props) {
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const [selection, setSelection] = useState<JarvisReportSuggestion | null>(null)
  if (selection && selection.value !== value) setSelection(null)
  const selected = selection?.value === value ? selection : null
  const matches = filterReportOptions(options, selected ? '' : value)
  const activeIndex = Math.min(highlighted, Math.max(0, matches.length - 1))
  const show = () => { setOpen(true); setHighlighted(0) }
  const select = (option: JarvisReportSuggestion) => {
    setSelection(option)
    onChange(option.value)
    setOpen(false)
    input.current?.focus()
  }
  const highlight = (index: number) => {
    setHighlighted(index)
    document.getElementById(`${id}-option-${index}`)?.scrollIntoView({ block: 'nearest' })
  }
  const keyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      highlight(open ? Math.max(0, Math.min(matches.length - 1, activeIndex + (event.key === 'ArrowDown' ? 1 : -1))) : 0)
    } else if (event.key === 'Enter' && open && matches[activeIndex]) {
      event.preventDefault()
      select(matches[activeIndex])
    } else if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
    }
  }

  return <div className="report-filter-combobox" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
  }}>
    <label htmlFor={id}>{label}</label>
    <div className="report-filter-combobox__field">
      <input ref={input} id={id} role="combobox" type="text" autoComplete="off" maxLength={200}
        aria-expanded={open} aria-controls={`${id}-options`} aria-autocomplete="list"
        aria-activedescendant={open && matches.length ? `${id}-option-${activeIndex}` : undefined}
        placeholder={placeholder} value={selected?.label ?? value} onFocus={show} onClick={show} onKeyDown={keyDown}
        onChange={event => { setSelection(null); onChange(event.target.value); show() }} />
      {value && <button type="button" className="report-filter-combobox__clear" aria-label={`Limpiar ${label.toLocaleLowerCase('es')}`}
        onMouseDown={event => event.preventDefault()} onClick={() => { setSelection(null); onChange(''); show(); input.current?.focus() }}>×</button>}
      <button type="button" className="report-filter-combobox__toggle" aria-label={`Mostrar opciones de ${label.toLocaleLowerCase('es')}`}
        aria-expanded={open} aria-controls={`${id}-options`} onMouseDown={event => event.preventDefault()}
        onClick={() => { input.current?.focus(); setOpen(!open); setHighlighted(0) }}><span aria-hidden="true">⌄</span></button>
    </div>
    {open && <ul id={`${id}-options`} role="listbox" aria-label={label} aria-busy={loading} className="report-filter-combobox__options">
      {matches.map((option, index) => <li key={option.value} id={`${id}-option-${index}`} role="option"
        aria-selected={value === option.value} className={index === activeIndex ? 'report-filter-combobox__option--active' : undefined}
        onMouseDown={event => event.preventDefault()} onMouseEnter={() => setHighlighted(index)} onClick={() => select(option)}>{option.label}</li>)}
      {!matches.length && <li className="report-filter-combobox__status" role="presentation">{loading ? 'Cargando opciones…' : failed ? 'No se pudieron cargar las opciones. Puedes escribir el filtro.' : value ? 'No hay coincidencias.' : 'No hay registros disponibles.'}</li>}
    </ul>}
  </div>
}
