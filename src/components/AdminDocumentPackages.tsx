import { useState, type FormEvent } from 'react'
import type { AdminCompanyListItem } from '../types/admin'
import { assignAdminDocumentPackage, fetchAdminDocumentPackage } from '../services/adminService'
import { getApiErrorMessage } from '../services/apiClient'
import ErrorMessage from './ErrorMessage'
import SuccessMessage from './SuccessMessage'

export default function AdminDocumentPackages({ companies }: { companies: AdminCompanyListItem[] }) {
  const [companyId, setCompanyId] = useState('')
  const [documents, setDocuments] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [result, setResult] = useState<unknown>(undefined)
  const [queried, setQueried] = useState(false)
  const company = companies.find(item => item.id === companyId)
  const plan = result && typeof result === 'object' ? result as Record<string, unknown> : null
  const balance = plan?.docs_left_absolut
  const planStart = plan?.absolut_start_plan_date


  async function run(assign: boolean) {
    if (!company) return
    const quantity = Number(documents)
    if (assign && (!Number.isSafeInteger(quantity) || quantity < 1)) {
      setError('Indica una cantidad entera mayor que cero.')
      return
    }
    setBusy(true); setError(null); setSuccess(null); setResult(undefined); setQueried(false)
    try {
      const response = assign
        ? await assignAdminDocumentPackage(company.id, { documents: quantity })
        : await fetchAdminDocumentPackage(company.id)
      setResult(response.data); setQueried(!assign)
      if (assign) setSuccess(`Paquete de ${quantity} documentos asignado para ${company.name}.`)
    } catch (failure) {
      setError(getApiErrorMessage(failure, 'No se pudo completar la operación. Intenta más tarde.'))
    } finally { setBusy(false) }
  }

  return <section className="admin-card">
    <div className="admin-card__header"><h2>Documentos NextPyme</h2><p>Asigna un paquete a una empresa o consulta su saldo usando el token que tiene guardado. Esta operación es independiente del cupo del plan Jarvis.</p></div>
    <form className="admin-form" onSubmit={(event: FormEvent) => { event.preventDefault(); void run(true) }}>
      <div className="admin-form__grid">
        <div className="admin-form__field"><label htmlFor="package-company">Empresa</label><select id="package-company" value={companyId} disabled={busy} required onChange={event => { setCompanyId(event.target.value); setResult(undefined); setQueried(false); setError(null); setSuccess(null) }}><option value="">Selecciona una empresa</option>{companies.map(item => <option key={item.id} value={item.id}>{item.name} · {item.nit}</option>)}</select></div>
        <div className="admin-form__field"><label htmlFor="package-documents">Documentos a habilitar</label><input id="package-documents" type="number" min="1" step="1" value={documents} onChange={event => setDocuments(event.target.value)} disabled={busy} required /></div>
      </div>
      <div><button type="button" disabled={busy || !company} onClick={() => void run(false)}>Consultar documentos disponibles</button> <button className="admin-form__submit" type="submit" disabled={busy || !company}>{busy ? 'Procesando...' : 'Asignar documentos'}</button></div>
      {error && <ErrorMessage inline message={error} />}{success && <SuccessMessage message={success} />}
      {queried && <div role="status">
        <p><strong>Fecha de inicio del plan:</strong> {typeof planStart === 'string' && planStart ? planStart : 'No informada'}</p>
        <p><strong>Documentos disponibles:</strong> {typeof balance === 'number' || typeof balance === 'string' ? balance : 'No informado'}</p>
      </div>}
      {result !== undefined && <details><summary>Detalle de la respuesta de NextPyme</summary><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{JSON.stringify(result, null, 2)}</pre></details>}
    </form>
  </section>
}
