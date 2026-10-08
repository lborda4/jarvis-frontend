import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'

export default function InvoiceNoteActions({ invoiceId, number, supportDocument = false }: { invoiceId: string; number: string; supportDocument?: boolean }) {
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  useEffect(() => {
    if (!position) return
    panel.current?.querySelector('a')?.focus()
    const closeOutside = (event: PointerEvent) => {
      if (!panel.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setPosition(null)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setPosition(null); trigger.current?.focus() }
    }
    const close = () => setPosition(null)
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', escape)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, true)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', escape)
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [position])
  return <>
    <button ref={trigger} type="button" className="sales-history__more" aria-label={`Más acciones de ${supportDocument ? 'documento' : 'factura'} ${number}`} aria-expanded={Boolean(position)} aria-controls={position ? `invoice-actions-${invoiceId}` : undefined} onClick={() => {
      if (position) { setPosition(null); return }
      const rect = trigger.current!.getBoundingClientRect()
      setPosition({ left: Math.max(8, Math.min(window.innerWidth - 196, rect.right - 188)), top: rect.bottom + 120 > window.innerHeight ? Math.max(8, rect.top - 116) : rect.bottom + 6 })
    }}><span aria-hidden="true">⋮</span></button>
    {position && createPortal(<div ref={panel} id={`invoice-actions-${invoiceId}`} className="invoice-note-actions" style={{ position: 'fixed', ...position }} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget) && event.relatedTarget !== trigger.current) setPosition(null) }}>
      {supportDocument
        ? <Link to={`/nota-ajuste/nueva?documento=${encodeURIComponent(invoiceId)}`}>Nota de ajuste</Link>
        : <>
            <Link to={`/nota-debito/nueva?factura=${encodeURIComponent(invoiceId)}`}>Nota débito</Link>
            <Link to={`/nota-credito/nueva?factura=${encodeURIComponent(invoiceId)}`}>Nota crédito</Link>
          </>}
    </div>, document.body)}
  </>
}
