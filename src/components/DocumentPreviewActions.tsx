import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import DocumentEmailModal, { MailIcon } from './DocumentEmailModal'
import { jarvisPdfCopy } from '../utils/jarvisPdfDocument'
import InvoiceNoteAction from './InvoiceNoteAction'
import type { DocumentEmailDelivery } from '../types/electronicDocument'
import { fetchJarvisInvoiceXml } from '../services/jarvisService'
import { triggerBrowserDownload } from '../utils/downloadFile'

function NoteIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M14 3H5v18h14V8l-5-5ZM14 3v5h5M8 12h8M8 16h5" strokeLinejoin="round" /></svg>
}

export default function DocumentPreviewActions({ id, number, kind, onEmailSent }: { id: string; number: string; kind: string; onEmailSent?: (delivery: DocumentEmailDelivery) => void }) {
  const [emailOpen, setEmailOpen] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState('')
  const menuRef = useRef<HTMLDetailsElement>(null)
  const copy = jarvisPdfCopy(kind)
  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target) && menuRef.current) menuRef.current.open = false
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && menuRef.current?.open) {
        menuRef.current.open = false
        menuRef.current.querySelector('summary')?.focus()
      }
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => { document.removeEventListener('pointerdown', closeOutside); document.removeEventListener('keydown', closeOnEscape) }
  }, [])
  async function downloadXml() {
    if (downloading) return
    setDownloading(true); setDownloadError('')
    try {
      const blob = await fetchJarvisInvoiceXml(id)
      triggerBrowserDownload(blob, `factura-${number.replace(/[^a-zA-Z0-9_-]/g, '') || 'venta'}.xml`)
    } catch {
      setDownloadError('No se pudo descargar el XML. Inténtalo nuevamente.')
    } finally { setDownloading(false) }
  }
  return <>
    {kind === 'ELECTRONIC_INVOICE' ? <details className="invoice-pdf__more" ref={menuRef}>
      <summary className="invoice-pdf__action" aria-label="Más opciones">⋮</summary>
      <div className="invoice-pdf__more-menu">
        <button type="button" className="invoice-pdf__action" onClick={() => { if (menuRef.current) menuRef.current.open = false; setEmailOpen(true) }}><MailIcon />Enviar correo</button>
        <InvoiceNoteAction className="invoice-pdf__action" invoiceId={id} kind="debit"><NoteIcon />Nota Débito</InvoiceNoteAction>
        <InvoiceNoteAction className="invoice-pdf__action" invoiceId={id} kind="credit"><NoteIcon />Nota Crédito</InvoiceNoteAction>
        <button type="button" className="invoice-pdf__action" disabled={downloading} onClick={() => void downloadXml()}>{downloading ? 'Descargando XML...' : 'Descargar XML'}</button>
        {downloadError && <p role="alert">{downloadError}</p>}
      </div>
    </details> : <button type="button" className="invoice-pdf__action" onClick={() => setEmailOpen(true)}><MailIcon />Enviar correo</button>}
    {kind === 'SUPPORT_DOCUMENT' && <Link className="invoice-pdf__action" to={`/nota-ajuste/nueva?documento=${encodeURIComponent(id)}`}><NoteIcon />Nota de ajuste</Link>}
    {emailOpen && <DocumentEmailModal id={id} number={number} documentLabel={copy.shortTitle.toLowerCase()} partyLabel={copy.party} onClose={() => setEmailOpen(false)} onSent={onEmailSent} />}
  </>
}
