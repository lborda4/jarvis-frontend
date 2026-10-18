import { lazy, Suspense, useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import Modal from './Modal'
import PdfViewerErrorBoundary from './PdfViewerErrorBoundary'
import { fetchInvoiceAttachment, type InvoiceAttachment } from '../services/invoiceAttachmentService'
import './InvoiceAttachmentAction.css'
import './InvoicePdfPreview.css'

const JarvisPdfViewer = lazy(() => import('./JarvisPdfViewer'))

export default function InvoiceAttachmentAction({ attachment, id, draft = false, file, disabled = false }: {
  attachment: InvoiceAttachment; id: string; draft?: boolean; file?: File; disabled?: boolean
}) {
  const titleId = useId()
  const [open, setOpen] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{ key: string; url: string } | null>(null)
  const [failure, setFailure] = useState('')
  const key = `${id}:${draft}:${attachment.name}:${attachment.size}:${attempt}`
  useEffect(() => {
    if (!open) return
    let active = true
    let url: string | undefined
    void (async () => {
      try {
        const blob = file ?? await fetchInvoiceAttachment(id, draft)
        if (!active) return
        url = URL.createObjectURL(new Blob([blob], { type: attachment.mimeType }))
        setResult({ key, url })
      } catch {
        if (active) setFailure(key)
      }
    })()
    return () => { active = false; if (url) URL.revokeObjectURL(url) }
  }, [open, id, draft, file, attachment.mimeType, key])
  const current = open && result?.key === key ? result : null
  return <span className="invoice-attachment-action" onClick={event => event.stopPropagation()}>
    <button type="button" className="invoice-pdf__action" disabled={disabled} onClick={() => { setAttempt(value => value + 1); setOpen(true) }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m8 13 6-6a3 3 0 0 1 4 4l-8 8a5 5 0 0 1-7-7l9-9" strokeLinecap="round" strokeLinejoin="round" /></svg>
      Ver adjunto
    </button>
    {open && createPortal(<Modal isOpen onClose={() => setOpen(false)} labelledBy={titleId} size="lg" className="invoice-attachment-modal">
      <h2 id={titleId}>{attachment.name}</h2>
      {current ? <>
        <a className="invoice-pdf__action" href={current.url} download={attachment.name}>Descargar adjunto</a>
        {attachment.mimeType === 'application/pdf'
          ? <PdfViewerErrorBoundary key={current.url}><Suspense fallback={<p role="status">Cargando visor…</p>}><JarvisPdfViewer url={current.url} /></Suspense></PdfViewerErrorBoundary>
          : <img className="invoice-attachment-modal__image" src={current.url} alt={attachment.name} />}
      </> : failure === key ? <div role="alert"><p>No se pudo abrir el adjunto.</p><button type="button" onClick={() => setAttempt(value => value + 1)}>Reintentar</button></div> : <p role="status">Cargando adjunto…</p>}
    </Modal>, document.body)}
  </span>
}
