import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import DateRangePicker, { type DateRangePickerValue } from './DateRangePicker'
import './DateRangeFilter.css'

export default function DateRangeFilter({ from, to, onApply, disabled = false }: {
  from: string; to: string; onApply: (range: DateRangePickerValue) => void; disabled?: boolean
}) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const id = useId()
  const format = (value: string) => value.split('-').reverse().join('/')
  const summary = from && to ? `${format(from)} – ${format(to)}` : from ? `Desde ${format(from)}` : to ? `Hasta ${format(to)}` : 'Todas'
  const locate = useCallback(() => {
    const rect = trigger.current?.getBoundingClientRect()
    if (!rect) return
    const width = window.innerWidth <= 640 ? Math.min(window.innerWidth * .92, 320) : 560
    setPosition({ left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)), top: Math.max(8, Math.min(rect.bottom + 8, window.innerHeight - 420)) })
  }, [])
  useEffect(() => {
    if (!position) return
    function outside(event: MouseEvent) {
      if (!trigger.current?.contains(event.target as Node) && !panel.current?.contains(event.target as Node)) setPosition(null)
    }
    function escape(event: KeyboardEvent) { if (event.key === 'Escape') { setPosition(null); trigger.current?.focus() } }
    document.addEventListener('mousedown', outside)
    document.addEventListener('keydown', escape)
    window.addEventListener('resize', locate)
    window.addEventListener('scroll', locate, true)
    return () => {
      document.removeEventListener('mousedown', outside)
      document.removeEventListener('keydown', escape)
      window.removeEventListener('resize', locate)
      window.removeEventListener('scroll', locate, true)
    }
  }, [position, locate])
  return <div className="date-range-filter">
    <span className="date-range-filter__label">Fecha</span>
    <div className="date-range-filter__field"><button ref={trigger} type="button" disabled={disabled} aria-label={`Filtro de fecha: ${summary}`} aria-expanded={Boolean(position)} aria-controls={position ? id : undefined} onClick={() => { if (position) setPosition(null); else locate() }}>{summary}<span aria-hidden="true">⌄</span></button>
      {(from || to) && <button className="date-range-filter__clear" type="button" disabled={disabled} aria-label="Quitar filtro de fecha" onClick={() => { onApply({ dateFrom: null, dateTo: null }); setPosition(null) }}>×</button>}
    </div>
    {position && createPortal(<div ref={panel} id={id} role="dialog" aria-label="Filtro de fecha" className="date-range-filter__calendar" style={{ ...position, maxHeight: `calc(100dvh - ${position.top + 8}px)` }}><DateRangePicker dateFrom={from || null} dateTo={to || null} onApply={range => { onApply(range); setPosition(null); trigger.current?.focus() }} /></div>, document.body)}
  </div>
}
