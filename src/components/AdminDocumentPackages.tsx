import { useRef, useState, type FormEvent } from 'react'
import type { AdminCompanyListItem } from '../types/admin'
import { assignAdminDocumentPackage, fetchAdminDocumentPackage } from '../services/adminService'
import { getApiErrorMessage } from '../services/apiClient'
import ErrorMessage from './ErrorMessage'
import SuccessMessage from './SuccessMessage'
import Button from './Button'
import './AdminDocumentPackages.css'

export default function AdminDocumentPackages({ company }: { company: AdminCompanyListItem }) {
  const [documents, setDocuments] = useState('')
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [result, setResult] = useState<unknown>(undefined)
  const [queried, setQueried] = useState(false)
  const plan = result && typeof result === 'object' ? result as Record<string, unknown> : null
  const balance = plan?.docs_left_absolut
  const planStart = plan?.absolut_start_plan_date


  async function run(assign: boolean) {
    if (busyRef.current) return
    const quantity = Number(documents)
    if (assign && (!Number.isSafeInteger(quantity) || quantity < 1)) {
      setError('Indica una cantidad entera mayor que cero.')
      return
    }
    busyRef.current = true
    setBusy(true); setError(null); setSuccess(null); setResult(undefined); setQueried(false)
    try {
      const response = assign
        ? await assignAdminDocumentPackage(company.id, { documents: quantity })
        : await fetchAdminDocumentPackage(company.id)
      setResult(response.data); setQueried(!assign)
      if (assign) setSuccess(`Paquete de ${quantity} documentos asignado para ${company.name}.`)
    } catch (failure) {
      setError(getApiErrorMessage(failure, 'No se pudo completar la operación. Intenta más tarde.'))
    } finally { busyRef.current = false; setBusy(false) }
  }

  return <section className="admin-card admin-document-packages" aria-label={`Documentos NextPyme de ${company.name}`}>
    <div className="admin-document-packages__heading">
      <h2>Documentos NextPyme</h2>
      <Button variant="outline" disabled={busy} onClick={() => void run(false)}>{busy ? 'Procesando…' : 'Consultar cuántos quedan en NextPyme'}</Button>
    </div>
    <form className="admin-form" onSubmit={(event: FormEvent) => { event.preventDefault(); void run(true) }}>
      <div className="admin-document-packages__controls">
        <div className="admin-form__field"><label htmlFor="package-documents">Documentos a habilitar</label><input id="package-documents" type="number" min="1" step="1" value={documents} onChange={event => setDocuments(event.target.value)} disabled={busy} required /></div>
        <Button type="submit" disabled={busy || !documents.trim()}>{busy ? 'Procesando…' : 'Habilitar documentos'}</Button>
      </div>
      {error && <ErrorMessage inline message={error} />}{success && <SuccessMessage message={success} />}
      {queried && <div className="admin-document-packages__balance" role="status">
        <span>Disponibles en NextPyme: <strong>{typeof balance === 'number' || typeof balance === 'string' ? balance : 'No informado'}</strong></span>
        {typeof planStart === 'string' && planStart && <span>Inicio del plan: {planStart}</span>}
      </div>}
    </form>
  </section>
}
