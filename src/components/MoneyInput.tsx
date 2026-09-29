import { useState, type InputHTMLAttributes } from 'react'
import { formatMoneyInput, parseMoneyInput } from '../utils/moneyInput'

type MoneyInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: string | number
  onValueChange: (value: string) => void
}

/** Keeps formatting out of the stored value and preserves incomplete decimals while typing. */
export default function MoneyInput({ value, onValueChange, onBlur, onKeyDown, ...props }: MoneyInputProps) {
  const [draft, setDraft] = useState<{ external: string | number; text: string } | null>(null)
  const display = draft && Object.is(draft.external, value) ? draft.text : formatMoneyInput(value)

  const updateValue = (input: HTMLInputElement) => {
      const suffixLength = input.value.slice(input.selectionStart ?? input.value.length).replace(/[^\d,]/g, '').length
      const canonical = parseMoneyInput(input.value)
      const formatted = formatMoneyInput(canonical)
      setDraft({ external: typeof value === 'number' ? Number(canonical) : canonical, text: formatted })
      onValueChange(canonical)
      // Restore the caret relative to the digits, including when grouping inserts a dot.
      requestAnimationFrame(() => {
        if (document.activeElement !== input) return
        let position = formatted.length
        let remaining = suffixLength
        while (position > 0 && remaining > 0) {
          position--
          if (/[\d,]/.test(formatted[position])) remaining--
        }
        input.setSelectionRange(position, position)
      })
  }

  return <input {...props} type="text" inputMode="decimal" value={display}
    onChange={(event) => updateValue(event.currentTarget)}
    onKeyDown={(event) => {
      onKeyDown?.(event)
      // Decimal keyboards may emit a dot; pasted Colombian dots remain grouping separators.
      if (!event.defaultPrevented && event.key === '.') {
        event.preventDefault()
        const input = event.currentTarget
        input.setRangeText(',', input.selectionStart ?? 0, input.selectionEnd ?? 0, 'end')
        updateValue(input)
      }
    }}
    onBlur={(event) => {
      setDraft({ external: value, text: formatMoneyInput(value, true) })
      onBlur?.(event)
    }}
  />
}
