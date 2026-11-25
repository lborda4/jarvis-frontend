import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import InvoiceNoteAction from './InvoiceNoteAction'

export function InvoiceNoteMenuItems({ invoiceId, number, supportDocument = false, onDownload, onDownloadXml, downloadDisabled = false, onClose }: { invoiceId: string; number: string; supportDocument?: boolean; onDownload?: () => void; onDownloadXml?: () => void; downloadDisabled?: boolean; onClose: () => void }) {
  return <>
    {onDownload && <button type="button" disabled={downloadDisabled} aria-label={`Descargar factura ${number}`} onClick={() => { onClose(); onDownload() }}>Descargar</button>}
    {onDownloadXml && <button type="button" disabled={downloadDisabled} aria-label={`Descargar XML de factura ${number}`} onClick={() => { onClose(); onDownloadXml() }}>Descargar XML</button>}
    <Link to={`${supportDocument ? '/documento-soporte/nuevo' : '/factura-venta/nueva'}?duplicar=${encodeURIComponent(invoiceId)}`} onClick={onClose}>Duplicar</Link>
    {supportDocument
      ? <Link to={`/nota-ajuste/nueva?documento=${encodeURIComponent(invoiceId)}`}>Nota de ajuste</Link>
      : <>
          <InvoiceNoteAction invoiceId={invoiceId} kind="debit">Nota débito</InvoiceNoteAction>
          <InvoiceNoteAction invoiceId={invoiceId} kind="credit">Nota crédito</InvoiceNoteAction>
        </>}
  </>
}

export default function InvoiceNoteActions({ invoiceId, number, supportDocument = false, onDownload, onDownloadXml, downloadDisabled = false }: { invoiceId: string; number: string; supportDocument?: boolean; onDownload?: () => void; onDownloadXml?: () => void; downloadDisabled?: boolean }) {
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  useEffect(() => {
    if (!position) return
    panel.current?.querySelector<HTMLElement>('a, button')?.focus()
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
      const menuHeight = (supportDocument ? 116 : 164) + (onDownload ? 48 : 0) + (onDownloadXml ? 48 : 0)
      setPosition({ left: Math.max(8, Math.min(window.innerWidth - 196, rect.right - 188)), top: rect.bottom + menuHeight + 8 > window.innerHeight ? Math.max(8, rect.top - menuHeight - 6) : rect.bottom + 6 })
    }}><span aria-hidden="true">⋮</span></button>
    {position && createPortal(<div ref={panel} id={`invoice-actions-${invoiceId}`} className="invoice-note-actions" style={{ position: 'fixed', ...position }} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget) && event.relatedTarget !== trigger.current) setPosition(null) }}>
      <InvoiceNoteMenuItems invoiceId={invoiceId} number={number} supportDocument={supportDocument} onDownload={onDownload} onDownloadXml={onDownloadXml} downloadDisabled={downloadDisabled} onClose={() => setPosition(null)} />
    </div>, document.body)}
  </>
}
