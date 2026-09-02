import { useMemo, useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from './icons/SidebarIcons'
import './DateRangePicker.css'

const WEEKDAY_LABELS = ['D', 'L', 'M', 'M', 'J', 'V', 'S']
const MONTH_LABELS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

function parseIsoDate(value: string | null | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
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

/** getDay() ya devuelve 0=Domingo...6=Sábado, igual que WEEKDAY_LABELS —
 * no hace falta el offset lunes-primero que usa DatePicker (single-date). */
function buildMonthGrid(year: number, month: number): Array<Date | null> {
  const firstOfMonth = new Date(year, month, 1)
  const startOffset = firstOfMonth.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: Array<Date | null> = []

  for (let i = 0; i < startOffset; i += 1) {
    cells.push(null)
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(year, month, day))
  }

  while (cells.length % 7 !== 0) {
    cells.push(null)
  }

  return cells
}

export interface DateRangePickerValue {
  dateFrom: string | null
  dateTo: string | null
}

interface DateRangePickerProps {
  dateFrom: string | null
  dateTo: string | null
  onApply: (range: DateRangePickerValue) => void
}

function DateRangePicker({ dateFrom, dateTo, onApply }: DateRangePickerProps) {
  const anchor = parseIsoDate(dateFrom) ?? parseIsoDate(dateTo) ?? new Date()
  const [baseYear, setBaseYear] = useState(anchor.getFullYear())
  const [baseMonth, setBaseMonth] = useState(anchor.getMonth())
  const [draftFrom, setDraftFrom] = useState(dateFrom)
  const [draftTo, setDraftTo] = useState(dateTo)

  const secondBase = new Date(baseYear, baseMonth + 1, 1)
  const secondYear = secondBase.getFullYear()
  const secondMonth = secondBase.getMonth()

  const firstGrid = useMemo(
    () => buildMonthGrid(baseYear, baseMonth),
    [baseYear, baseMonth],
  )
  const secondGrid = useMemo(
    () => buildMonthGrid(secondYear, secondMonth),
    [secondYear, secondMonth],
  )

  const goToPreviousPair = () => {
    const next = new Date(baseYear, baseMonth - 1, 1)
    setBaseYear(next.getFullYear())
    setBaseMonth(next.getMonth())
  }

  const goToNextPair = () => {
    const next = new Date(baseYear, baseMonth + 1, 1)
    setBaseYear(next.getFullYear())
    setBaseMonth(next.getMonth())
  }

  const handleDayClick = (date: Date) => {
    const iso = formatIsoDate(date)

    // Sin inicio, o ya había un rango completo: arranca uno nuevo.
    if (!draftFrom || draftTo) {
      setDraftFrom(iso)
      setDraftTo(null)
      return
    }

    // Ya hay un inicio elegido — este clic cierra el rango (si el día
    // elegido queda antes del inicio, se invierten en vez de rechazarlo).
    if (iso < draftFrom) {
      setDraftTo(draftFrom)
      setDraftFrom(iso)
    } else {
      setDraftTo(iso)
    }
  }

  const isInRange = (iso: string): boolean => {
    if (!draftFrom) {
      return false
    }

    const end = draftTo ?? draftFrom
    const [start, finish] = draftFrom <= end ? [draftFrom, end] : [end, draftFrom]

    return iso >= start && iso <= finish
  }

  const renderMonth = (year: number, month: number, grid: Array<Date | null>) => (
    <div className="date-range-picker__month">
      <div className="date-range-picker__month-label">
        {MONTH_LABELS[month]} {year}
      </div>
      <div className="date-range-picker__weekdays">
        {WEEKDAY_LABELS.map((label, index) => (
          <span key={index}>{label}</span>
        ))}
      </div>
      <div className="date-range-picker__grid">
        {grid.map((date, index) => {
          if (!date) {
            return (
              <span
                key={index}
                className="date-range-picker__day date-range-picker__day--empty"
              />
            )
          }

          const iso = formatIsoDate(date)
          const isEdge = iso === draftFrom || iso === draftTo
          const inRange = isInRange(iso)

          return (
            <button
              key={index}
              type="button"
              className={[
                'date-range-picker__day',
                inRange ? 'date-range-picker__day--in-range' : '',
                isEdge ? 'date-range-picker__day--selected' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => handleDayClick(date)}
            >
              {date.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )

  return (
    <div className="date-range-picker">
      <div className="date-range-picker__months">
        <button
          type="button"
          className="date-range-picker__nav date-range-picker__nav--prev"
          onClick={goToPreviousPair}
          aria-label="Meses anteriores"
        >
          <ChevronLeftIcon />
        </button>

        {renderMonth(baseYear, baseMonth, firstGrid)}
        {renderMonth(secondYear, secondMonth, secondGrid)}

        <button
          type="button"
          className="date-range-picker__nav date-range-picker__nav--next"
          onClick={goToNextPair}
          aria-label="Meses siguientes"
        >
          <ChevronRightIcon />
        </button>
      </div>

      <div className="date-range-picker__footer">
        <button
          type="button"
          className="date-range-picker__apply"
          onClick={() => onApply({ dateFrom: draftFrom, dateTo: draftTo })}
        >
          Listo
        </button>
      </div>
    </div>
  )
}

export default DateRangePicker
