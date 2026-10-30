import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export interface PayrollRowAction {
  label: string
  onClick: () => void
  danger?: boolean
}

export default function PayrollRowActions({ name, actions, disabled }: {
  name: string
  actions: PayrollRowAction[]
  disabled?: boolean
}) {
  const trigger = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)
  useEffect(() => {
    if (!position) return
    menu.current?.querySelector<HTMLButtonElement>('button')?.focus()
    const close = () => setPosition(null)
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !trigger.current?.contains(event.target) && !menu.current?.contains(event.target)) close()
    }
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { close(); trigger.current?.focus() }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        const buttons = [...(menu.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])]
        const current = buttons.findIndex(button => button === document.activeElement)
        buttons[(current + (event.key === 'ArrowDown' ? 1 : buttons.length - 1)) % buttons.length]?.focus()
      }
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', key)
    window.addEventListener('resize', close)
    const scroll = (event: Event) => { if (!(event.target instanceof Node) || !menu.current?.contains(event.target)) close() }
    window.addEventListener('scroll', scroll, true)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', key)
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', scroll, true)
    }
  }, [position])
  return <>
    <button type="button" ref={trigger} className="payroll__period-action" aria-label={`Acciones de ${name}`} aria-haspopup="menu" aria-expanded={Boolean(position)} disabled={disabled || !actions.length} onClick={() => {
      if (position) { setPosition(null); return }
      const rect = trigger.current!.getBoundingClientRect()
      const height = Math.min(actions.length * 40 + 16, window.innerHeight - 16)
      setPosition({ left: Math.max(8, Math.min(rect.right - 190, window.innerWidth - 198)), top: rect.bottom + height + 6 <= window.innerHeight ? rect.bottom + 6 : Math.max(8, rect.top - height - 6) })
    }}>•••</button>
    {position && createPortal(<div ref={menu} className="payroll-row-menu" role="menu" aria-label={`Acciones de ${name}`} style={position}>
      {actions.map(action => <button type="button" role="menuitem" key={action.label} className={action.danger ? 'payroll-row-menu__danger' : undefined} onClick={() => { setPosition(null); action.onClick() }}>{action.label}</button>)}
    </div>, document.body)}
  </>
}
