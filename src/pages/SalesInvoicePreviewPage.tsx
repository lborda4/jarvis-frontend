import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import InvoicePdfPreview from '../components/InvoicePdfPreview'
import LoadingIndicator from '../components/LoadingIndicator'
import Button from '../components/Button'
import { fetchJarvisInvoicePdfData } from '../services/jarvisService'
import { getApiErrorMessage } from '../services/apiClient'
import { useAuth } from '../context/AuthContext'

export default function SalesInvoicePreviewPage() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const companyId = user?.company?.id
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{ key: string; url: string; number: string } | null>(null)
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
        setResult({ key, url, number: data.invoiceNumber || id })
      } catch (error) {
        if (active) setFailure({ key, message: getApiErrorMessage(error, 'No se pudo generar el PDF. La factura sigue emitida; puedes reintentar la visualización.') })
      }
    }
    void load()
    return () => { active = false; if (url) URL.revokeObjectURL(url) }
  }, [id, key])
  const current = result?.key === key ? result : null
  const error = failure?.key === key ? failure.message : null
  return <main className="integration-page sales-invoice-preview">
    <Link to="/factura-venta">← Volver a la lista de facturas</Link>
    {error ? <div role="alert"><p>{error}</p><p>Este problema corresponde al PDF. No es necesario volver a enviar la factura.</p><Button onClick={() => setAttempt(value => value + 1)}>Reintentar PDF</Button></div>
      : current ? <InvoicePdfPreview standalone number={current.number} pdfUrl={current.url} onClose={() => navigate('/factura-venta')} />
      : <LoadingIndicator message="Preparando el PDF de la factura…" />}
  </main>
}
