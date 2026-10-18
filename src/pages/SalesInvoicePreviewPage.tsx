import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import InvoicePdfPreview from '../components/InvoicePdfPreview'
import LoadingIndicator from '../components/LoadingIndicator'
import PdfPreviewError from '../components/PdfPreviewError'
import DocumentPreviewActions from '../components/DocumentPreviewActions'
import InvoiceAttachmentAction from '../components/InvoiceAttachmentAction'
import type { InvoiceAttachment } from '../services/invoiceAttachmentService'
import { fetchJarvisInvoicePdfData } from '../services/jarvisService'
import { useAuth } from '../context/AuthContext'
import { jarvisPdfCopy, jarvisPdfKindFromFlags } from '../utils/jarvisPdfDocument'

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
  const { user } = useAuth()
  const navigate = useNavigate()
  const fallback = jarvisPdfCopy(jarvisPdfKindFromFlags({ supportDocument, creditNote, debitNote, adjustmentNote }))
  const companyId = user?.company?.id
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{ key: string; url: string; number: string; documentLabel: string; listPath: string; kind: string; code: string; codeLabel: string; attachment?: InvoiceAttachment } | null>(null)
  const [failure, setFailure] = useState<{ key: string } | null>(null)
  const key = `${companyId}:${id}:${attempt}`
  useEffect(() => {
    let active = true
    let url: string | undefined
    async function load() {
      try {
        const [data, renderer] = await Promise.all([fetchJarvisInvoicePdfData(id), import('../utils/salesInvoicePdf')])
        if (!active) return
        const blob = await renderer.generateSalesInvoicePdf(data)
        if (!active) return
        url = URL.createObjectURL(blob)
        const kind = data.documentKind ?? jarvisPdfKindFromFlags({ supportDocument, creditNote, debitNote, adjustmentNote })
        const copy = jarvisPdfCopy(kind)
        setResult({ key, url, number: data.invoiceNumber || id, documentLabel: copy.shortTitle, listPath: copy.listPath, kind, code: data.cufe ?? '', codeLabel: copy.uniqueCode, attachment: data.attachment })
      } catch {
        if (active) setFailure({ key })
      }
    }
    void load()
    return () => { active = false; if (url) URL.revokeObjectURL(url) }
  }, [id, key, supportDocument, creditNote, debitNote, adjustmentNote, fallback.shortTitle])
  const current = result?.key === key ? result : null
  const error = failure?.key === key
  const listPath = current?.listPath ?? fallback.listPath
  return <main className="integration-page sales-invoice-preview">
    <Link to={listPath}>← Volver a la lista</Link>
    {error ? <PdfPreviewError onRetry={() => setAttempt(value => value + 1)} />
      : current ? <InvoicePdfPreview standalone number={current.number} documentLabel={current.documentLabel} documentCode={current.code} codeLabel={current.codeLabel} pdfUrl={current.url} onClose={() => navigate(listPath)} actions={<><DocumentPreviewActions key={`${companyId}:${id}`} id={id} number={current.number} kind={current.kind} />{current.attachment && <InvoiceAttachmentAction key={`attachment:${companyId}:${id}`} id={id} attachment={current.attachment} />}</>} />
      : <LoadingIndicator message={`Preparando el PDF de ${fallback.shortTitle.toLowerCase()}…`} />}
  </main>
}
