import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import InvoicePdfPreview from '../components/InvoicePdfPreview'
import LoadingIndicator from '../components/LoadingIndicator'
import Button from '../components/Button'
import { fetchJarvisInvoicePdfData } from '../services/jarvisService'
import { getApiErrorMessage } from '../services/apiClient'
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
  const [result, setResult] = useState<{ key: string; url: string; number: string; documentLabel: string; listPath: string } | null>(null)
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null)
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
        const copy = jarvisPdfCopy(data.documentKind ?? jarvisPdfKindFromFlags({ supportDocument, creditNote, debitNote, adjustmentNote }))
        setResult({ key, url, number: data.invoiceNumber || id, documentLabel: copy.shortTitle, listPath: copy.listPath })
      } catch (error) {
        if (active) setFailure({ key, message: getApiErrorMessage(error, `No se pudo generar el PDF. ${fallback.shortTitle} sigue emitido; puedes reintentar la visualización.`) })
      }
    }
    void load()
    return () => { active = false; if (url) URL.revokeObjectURL(url) }
  }, [id, key, supportDocument, creditNote, debitNote, adjustmentNote, fallback.shortTitle])
  const current = result?.key === key ? result : null
  const error = failure?.key === key ? failure.message : null
  const listPath = current?.listPath ?? fallback.listPath
  return <main className="integration-page sales-invoice-preview">
    <Link to={listPath}>← Volver a la lista</Link>
    {error ? <div role="alert"><p>{error}</p><p>Este problema corresponde al PDF. No es necesario volver a enviar el documento.</p><Button onClick={() => setAttempt(value => value + 1)}>Reintentar PDF</Button></div>
      : current ? <InvoicePdfPreview standalone number={current.number} documentLabel={current.documentLabel} pdfUrl={current.url} onClose={() => navigate(listPath)} />
      : <LoadingIndicator message={`Preparando el PDF de ${fallback.shortTitle.toLowerCase()}…`} />}
  </main>
}
