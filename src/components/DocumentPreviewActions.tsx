import { useState } from 'react'
import { Link } from 'react-router-dom'
import DocumentEmailModal, { MailIcon } from './DocumentEmailModal'
import { jarvisPdfCopy } from '../utils/jarvisPdfDocument'
import InvoiceNoteAction from './InvoiceNoteAction'

function NoteIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M14 3H5v18h14V8l-5-5ZM14 3v5h5M8 12h8M8 16h5" strokeLinejoin="round" /></svg>
}

export default function DocumentPreviewActions({ id, number, kind }: { id: string; number: string; kind: string }) {
  const [emailOpen, setEmailOpen] = useState(false)
  const copy = jarvisPdfCopy(kind)
  return <>
    <button type="button" className="invoice-pdf__action" onClick={() => setEmailOpen(true)}><MailIcon />Enviar correo</button>
    {kind === 'ELECTRONIC_INVOICE' && <>
      <InvoiceNoteAction className="invoice-pdf__action" invoiceId={id} kind="debit"><NoteIcon />Nota Débito</InvoiceNoteAction>
      <InvoiceNoteAction className="invoice-pdf__action" invoiceId={id} kind="credit"><NoteIcon />Nota Crédito</InvoiceNoteAction>
    </>}
    {kind === 'SUPPORT_DOCUMENT' && <Link className="invoice-pdf__action" to={`/nota-ajuste/nueva?documento=${encodeURIComponent(id)}`}><NoteIcon />Nota de ajuste</Link>}
    {emailOpen && <DocumentEmailModal id={id} number={number} documentLabel={copy.shortTitle.toLowerCase()} partyLabel={copy.party} onClose={() => setEmailOpen(false)} />}
  </>
}
