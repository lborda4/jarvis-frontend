import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react'
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from './icons/SidebarIcons'
import './DatePicker.css'

const WEEKDAY_LABELS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do']
const MONTH_LABELS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const PANEL_GAP = 6

interface DatePickerProps {
  id?: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
  minDate?: string
  className?: string
}

function parseIsoDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null
  }

  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDisplayDate(value: string): string {
  const date = parseIsoDate(value)
  if (!date) return ''

  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${day}/${month}/${date.getFullYear()}`
}

/** Lunes=0 ... Domingo=6, para alinear la grilla con el encabezado Lu-Do. */
function mondayIndex(date: Date): number {
  return (date.getDay() + 6) % 7
}

function buildMonthGrid(year: number, month: number): Date[] {
  const firstOfMonth = new Date(year, month, 1)
  const startOffset = mondayIndex(firstOfMonth)
  const gridStart = new Date(year, month, 1 - startOffset)

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart)
    date.setDate(gridStart.getDate() + index)
    return date
  })
}

function DatePicker({
  id,
  value,
  onChange,
  disabled = false,
  placeholder = 'dd/mm/aaaa',
  minDate,
  className,
}: DatePickerProps) {
  const dialogId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({})
  const selectedDate = useMemo(() => parseIsoDate(value), [value])
  const [viewYear, setViewYear] = useState(() => (selectedDate ?? new Date()).getFullYear())
  const [viewMonth, setViewMonth] = useState(() => (selectedDate ?? new Date()).getMonth())
  const minDateObj = useMemo(
    () => (minDate ? parseIsoDate(minDate) : null),
    [minDate],
  )

  const openPanel = useCallback(() => {
    const base = selectedDate ?? new Date()
    setViewYear(base.getFullYear())
    setViewMonth(base.getMonth())
    setIsOpen(true)
  }, [selectedDate])

  const updatePanelPosition = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    const rect = container.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom - PANEL_GAP
    const spaceAbove = rect.top - PANEL_GAP
    const openAbove = spaceBelow < 320 && spaceAbove > spaceBelow

    setPanelStyle(
      openAbove
        ? {
            position: 'fixed',
            left: rect.left,
            bottom: window.innerHeight - rect.top + PANEL_GAP,
            zIndex: 1000,
          }
        : {
            position: 'fixed',
            left: rect.left,
            top: rect.bottom + PANEL_GAP,
            zIndex: 1000,
          },
    )
  }, [])

  useLayoutEffect(() => {
    if (!isOpen) return

    updatePanelPosition()
    const handle = () => updatePanelPosition()
    window.addEventListener('resize', handle)
    window.addEventListener('scroll', handle, true)

    return () => {
      window.removeEventListener('resize', handle)
      window.removeEventListener('scroll', handle, true)
    }
  }, [isOpen, updatePanelPosition])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      setIsOpen(false)
    }
  }

  const grid = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth])

  const goToPreviousMonth = () => {
    const next = new Date(viewYear, viewMonth - 1, 1)
    setViewYear(next.getFullYear())
    setViewMonth(next.getMonth())
  }

  const goToNextMonth = () => {
    const next = new Date(viewYear, viewMonth + 1, 1)
    setViewYear(next.getFullYear())
    setViewMonth(next.getMonth())
  }

  const selectDate = (date: Date) => {
    onChange(formatIsoDate(date))
    setIsOpen(false)
  }

  return (
    <div className={['date-picker', className].filter(Boolean).join(' ')} ref={containerRef}>
      <button
        type="button"
        id={id}
        className="date-picker__trigger"
        onClick={() => !disabled && (isOpen ? setIsOpen(false) : openPanel())}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={dialogId}
      >
        <span className={`date-picker__value${value ? '' : ' date-picker__value--placeholder'}`}>
          {value ? formatDisplayDate(value) : placeholder}
        </span>
        <CalendarIcon className="date-picker__icon" />
      </button>

      {isOpen && !disabled && (
        <div
          id={dialogId}
          role="dialog"
          aria-label="Seleccionar fecha"
          className="date-picker__panel"
          style={panelStyle}
        >
          <div className="date-picker__header">
            <button
              type="button"
              className="date-picker__nav"
              onClick={goToPreviousMonth}
              aria-label="Mes anterior"
            >
              <ChevronLeftIcon />
            </button>
            <span className="date-picker__month-label">
              {MONTH_LABELS[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              className="date-picker__nav"
              onClick={goToNextMonth}
              aria-label="Mes siguiente"
            >
              <ChevronRightIcon />
            </button>
          </div>

          <div className="date-picker__weekdays">
            {WEEKDAY_LABELS.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>

          <div className="date-picker__grid">
            {grid.map((date) => {
              const iso = formatIsoDate(date)
              const isCurrentMonth = date.getMonth() === viewMonth
              const isSelected = value === iso
              const isDisabled = Boolean(minDateObj && date < minDateObj)

              return (
                <button
                  key={iso}
                  type="button"
                  className={[
                    'date-picker__day',
                    isCurrentMonth ? '' : 'date-picker__day--outside',
                    isSelected ? 'date-picker__day--selected' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => selectDate(date)}
                  disabled={isDisabled}
                >
                  {date.getDate()}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default DatePicker
