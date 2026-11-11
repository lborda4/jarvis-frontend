import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import InvoicePdfPreview from '../components/InvoicePdfPreview'
import LoadingIndicator from '../components/LoadingIndicator'
import PdfPreviewError from '../components/PdfPreviewError'
import DocumentPreviewActions from '../components/DocumentPreviewActions'
import InvoiceAttachmentAction from '../components/InvoiceAttachmentAction'
import type { InvoiceAttachment } from '../services/invoiceAttachmentService'
import { fetchJarvisInvoicePdfData } from '../services/jarvisService'
import { fetchInvoiceDraftPreview } from '../services/invoiceDraftPreviewService'
import { useAuth } from '../context/AuthContext'
import { jarvisPdfCopy, jarvisPdfKindFromFlags } from '../utils/jarvisPdfDocument'
import { loadSalesInvoicePdfRenderer, PdfModuleLoadError } from '../utils/loadSalesInvoicePdfRenderer'

export default function SalesInvoicePreviewPage({
  supportDocument = false,
  creditNote = false,
  debitNote = false,
  adjustmentNote = false,
}: {
  supportDocument?: boolean
  creditNote?: boolean
  debitNote?: boolean
  adjustmentNote?: boolean
}) {
  const { id = '' } = useParams()
  const [searchParams] = useSearchParams()
  const isDraft = searchParams.get('borrador') === '1'
  const { user } = useAuth()
  const company = user?.company
  const navigate = useNavigate()
  const fallback = jarvisPdfCopy(jarvisPdfKindFromFlags({ supportDocument, creditNote, debitNote, adjustmentNote }))
  const companyId = user?.company?.id
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{ key: string; url: string; number: string; documentLabel: string; listPath: string; kind: string; code: string; codeLabel: string; attachment?: InvoiceAttachment } | null>(null)
  const [failure, setFailure] = useState<{ key: string; reload: boolean } | null>(null)
  const key = `${companyId}:${id}:${isDraft}:${attempt}`
  useEffect(() => {
    let active = true
    let url: string | undefined
    async function load() {
      let stage = 'carga de datos y generador'
      try {
        if (isDraft && !company) return
        const expectedKind = jarvisPdfKindFromFlags({ supportDocument, creditNote, debitNote, adjustmentNote })
        const [data, renderer] = await Promise.all([
          isDraft ? fetchInvoiceDraftPreview(id, expectedKind, company!) : fetchJarvisInvoicePdfData(id),
          loadSalesInvoicePdfRenderer(),
        ])
        if (!active) return
        stage = 'generación del PDF'
        const blob = await renderer.generateSalesInvoicePdf(data)
        if (!active) return
        stage = 'apertura de la vista previa'
        url = URL.createObjectURL(blob)
        const kind = data.documentKind ?? jarvisPdfKindFromFlags({ supportDocument, creditNote, debitNote, adjustmentNote })
        const copy = jarvisPdfCopy(kind)
        setResult({ key, url, number: data.invoiceNumber || id, documentLabel: isDraft ? `${copy.shortTitle} · Borrador` : copy.shortTitle, listPath: copy.listPath, kind, code: data.cufe ?? '', codeLabel: copy.uniqueCode, attachment: data.attachment })
      } catch (error) {
        if (active) {
          console.error('[Jarvis PDF] Falló la preparación de la factura.', { documentId: id, stage }, error)
          setFailure({ key, reload: error instanceof PdfModuleLoadError })
        }
      }
    }
    void load()
    return () => { active = false; if (url) URL.revokeObjectURL(url) }
  }, [id, key, supportDocument, creditNote, debitNote, adjustmentNote, fallback.shortTitle, isDraft, company])
  const current = result?.key === key ? result : null
  const error = failure?.key === key
  const listPath = current?.listPath ?? fallback.listPath
  const editPath = `${listPath}/${supportDocument ? 'nuevo' : 'nueva'}?borrador=${encodeURIComponent(id)}`
  return <main className="integration-page sales-invoice-preview">
    <Link to={listPath}>← Volver a la lista</Link>
    {error ? <PdfPreviewError onRetry={() => {
      if (failure?.reload) window.location.reload()
      else setAttempt(value => value + 1)
    }} />
      : current ? <InvoicePdfPreview standalone number={current.number} documentLabel={current.documentLabel} documentCode={current.code} codeLabel={current.codeLabel} pdfUrl={current.url} onClose={() => navigate(listPath)} actions={<>{isDraft ? <Link className="invoice-pdf__download" to={editPath}>Editar</Link> : <DocumentPreviewActions key={`${companyId}:${id}`} id={id} number={current.number} kind={current.kind} />}{current.attachment && <InvoiceAttachmentAction key={`attachment:${companyId}:${id}`} id={id} draft={isDraft} attachment={current.attachment} />}</>} />
      : <LoadingIndicator message={`Preparando el PDF de ${fallback.shortTitle.toLowerCase()}…`} />}
  </main>
}
