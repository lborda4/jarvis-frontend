import { createPortal } from 'react-dom'
import Modal from './Modal'
import { lazy, Suspense } from 'react'
import './InvoicePdfPreview.css'

const JarvisPdfViewer = lazy(() => import('./JarvisPdfViewer'))

export default function InvoicePdfPreview({ number, pdfUrl, onClose, standalone = false, documentLabel = 'Factura' }: {
  number: string; pdfUrl?: string; onClose: () => void; standalone?: boolean; documentLabel?: string
}) {
  const Title = standalone ? 'h1' : 'h2'
  const content = <>
    <header className="invoice-pdf__header">
      <Title id="invoice-pdf-title">{documentLabel} {number}</Title>
      {pdfUrl ? <a className="invoice-pdf__download" href={pdfUrl} download={`${documentLabel}-${number}.pdf`}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 3v12m-4-4 4 4 4-4M5 16v4h14v-4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        Descargar PDF</a>
        : <button className="invoice-pdf__download" disabled title="El PDF todavía no está disponible">Descargar PDF</button>}
    </header>
    {pdfUrl ? <Suspense fallback={<p role="status">Cargando visor…</p>}><JarvisPdfViewer key={pdfUrl} url={pdfUrl} /></Suspense>
      : <div className="invoice-pdf__empty"><svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><path d="M14 2H5v20h14V7zM14 2v6h5M8 13h8M8 17h6" /></svg><h3>El PDF aún no está disponible</h3><p>Cuando esté conectado el documento, podrás verlo y descargarlo aquí.</p></div>}
  </>
  return standalone ? <section className="invoice-pdf invoice-pdf--page">{content}</section>
    : createPortal(<Modal isOpen onClose={onClose} labelledBy="invoice-pdf-title" size="lg" className="invoice-pdf">{content}</Modal>, document.body)
}
