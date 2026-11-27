import { useEffect, useId, useRef, useState } from 'react'
import Modal from '../../components/Modal'
import DocumentSendOverlay from '../../components/DocumentSendOverlay'
import { payrollService, type Concept, type PayrollDetail, type PayrollState } from '../../services/payrollService'
import { getApiErrorMessage } from '../../services/apiClient'
import { payrollSubmissionErrors } from '../../utils/payrollSubmissionErrors'
import { cents, money } from '../../utils/payrollDomain'
import { shouldShowTablePagination } from '../../utils/tablePagination'
import { currency, employeeName, localDate, statusLabels } from './payrollDefaults'
import type { PayrollMonth } from './payrollMonths'
import { payrollAdjustmentTargets } from './payrollAdjustmentTargets'
import PayrollNoveltyModal from './PayrollNoveltyModal'

const dateLabel = (value: string) => value.split('-').reverse().join('/')
export default function PayrollAdjustmentModal({ month, noteType, concepts, onClose, onReload, onBusyChange }: {
  month: PayrollMonth; noteType: 1 | 2; concepts: Concept[]; onClose: () => void;
  onReload: () => Promise<void>; onBusyChange: (busy: boolean) => void
}) {
  const titleId = useId()
  const targets = payrollAdjustmentTargets(month)
  const [selectedId, setSelectedId] = useState(targets.length === 1 ? targets[0].id : '')
  const target = targets.find(item => item.id === selectedId)
  const [original, setOriginal] = useState<PayrollDetail | null>(null)
  const [draft, setDraft] = useState<PayrollDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<PayrollDetail | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [page, setPage] = useState(1)
  const submitting = useRef(false)
  const adjustmentId = useRef('')
  const pending = target?.document.adjustment
  const pendingId = pending && ['DRAFT', 'REJECTED', 'PROCESSING', 'UNCERTAIN'].includes(pending.status) ? pending.id : undefined
  const originalId = target?.originalId
  useEffect(() => {
    setOriginal(null); setDraft(null); setError(''); setResult(null); setPage(1)
    if (!originalId) return
    let active = true
    setLoading(true)
    void Promise.all([payrollService.get(originalId), pendingId ? payrollService.get(pendingId) : Promise.resolve(null)])
      .then(([source, existing]) => {
        if (!active) return
        if (existing && existing.state.noteType !== noteType) throw new Error('Este empleado ya tiene otro tipo de ajuste pendiente. Termínalo antes de crear uno nuevo.')
        adjustmentId.current = existing?.id ?? crypto.randomUUID()
        setOriginal(source)
        setDraft(existing ?? { ...source, id: adjustmentId.current, status: 'DRAFT', updated_at: undefined, number: null, prefix: null, cune: null, transmissions: [], files: [],
          state: { ...source.state, originalId: source.id, noteType, issueDate: localDate(), notes: '' } })
        if (existing && !['DRAFT', 'REJECTED'].includes(existing.status)) setResult(existing)
        setEditing(noteType === 1 && (!existing || ['DRAFT', 'REJECTED'].includes(existing.status)))
      }).catch(error => { if (active) setError(getApiErrorMessage(error, 'No se pudo cargar la nómina enviada.')) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [originalId, pendingId, noteType, attempt])
  const update = (patch: Partial<PayrollState>) => setDraft(previous => previous ? { ...previous, state: { ...previous.state, ...patch } } : previous)
  const send = async () => {
    if (!draft || !original || submitting.current || !draft.state.notes?.trim()) return
    submitting.current = true; setBusy(true); onBusyChange(true); setError(''); setResult(null)
    try {
      const prepared = await payrollService.prepareAdjustment(original.id, adjustmentId.current, {
        noteType, state: draft.state, originalUpdatedAt: original.updated_at ?? '', updatedAt: draft.updated_at,
      })
      setDraft(prepared)
      if (prepared.status !== 'DRAFT' && prepared.status !== 'REJECTED') { setResult(prepared); await onReload(); return }
      try {
        const sent = await payrollService.send(prepared.id)
        setDraft(sent); setResult(sent)
      } catch (error) {
        setError(getApiErrorMessage(error, 'No se pudo confirmar el ajuste. Verifica su estado antes de reintentar.'))
        try { const saved = await payrollService.get(prepared.id); setDraft(saved); setResult(saved) } catch { /* Conservar la solicitud preparada para verificarla. */ }
      }
      try { await onReload() } catch { setError(previous => previous || 'El resultado se conservó, pero no se pudo actualizar el listado. Vuelve a consultarlo.') }
    } catch (error) { setError(getApiErrorMessage(error, 'No se pudo preparar el ajuste.')) }
    finally { submitting.current = false; setBusy(false); onBusyChange(false) }
  }
  const checkStatus = async () => {
    if (!draft || submitting.current) return
    submitting.current = true; setBusy(true); onBusyChange(true); setError('')
    try { const checked = await payrollService.status(draft.id); setDraft(checked); setResult(checked); await onReload() }
    catch (error) { setError(getApiErrorMessage(error, 'No se pudo consultar el estado del ajuste.')) }
    finally { submitting.current = false; setBusy(false); onBusyChange(false) }
  }
  const lines = draft?.state.lines ?? []
  const accrued = money(lines.filter(line => line.kind === 'accrued').reduce((sum, line) => {
    const key = line.mapping ?? line.concept
    return sum + cents(line.amount) + (['service_bonus', 'premium'].includes(key) ? cents(line.paymentNS || '0') : key === 'severance' ? cents(line.interestPayment || '0') : 0n)
  }, 0n))
  const deductions = money(lines.filter(line => line.kind === 'deduction').reduce((sum, line) => sum + cents(line.amount), 0n))
  const pageSize = 10
  const pages = Math.max(1, Math.ceil(lines.length / pageSize))
  const currentPage = Math.min(page, pages)
  const locked = Boolean(result && !['DRAFT', 'REJECTED'].includes(result.status))
  const messages = result && result.status !== 'ACCEPTED' ? payrollSubmissionErrors(result.transmissions[0]) : []
  return <>
    <Modal isOpen size="lg" busy={busy || editing} labelledBy={titleId} className="payroll payroll-adjustment-modal" onClose={onClose}>
      <h2 className="modal-dialog__title" id={titleId}>{noteType === 2 ? 'Eliminar envío de nómina' : 'Reemplazar nómina'} · {month.label}</h2>
      <p className="payroll__muted">El ajuste corresponde al documento mensual de un empleado e incluye todas sus quincenas. El documento original se conserva en el historial.</p>
      <label>Empleado<select value={selectedId} disabled={busy} onChange={event => setSelectedId(event.target.value)}>
        <option value="">Selecciona un empleado</option>
        {targets.map(item => <option key={item.id} value={item.id} disabled={!item.originalId}>{employeeName(item.document.employee)} · {item.document.employee.identification}{!item.originalId ? ' · Anulada' : ''}</option>)}
      </select></label>
      {!targets.length && <p className="payroll__notice">No hay documentos aceptados para ajustar en este mes.</p>}
      {loading && <p role="status">Cargando la información enviada…</p>}
      {error && <div className="payroll__notice payroll__notice--error" role="alert">{error}{!draft && <button className="payroll__link" onClick={() => setAttempt(value => value + 1)}>Reintentar</button>}</div>}
      {original && draft && <>
        <p><strong>{employeeName(original.employee_snapshot)}</strong> · {original.employee_snapshot.identification}</p>
        <p className="payroll__muted">Documento {formatJarvisDocumentNumber(original.prefix, original.number)} · {dateLabel(original.state.startDate)} – {dateLabel(original.state.endDate)} · Emitido el {dateLabel(original.state.issueDate)}</p>
        <div className="payroll-employee-modal__totals"><div><span>Ingresos</span><strong>{currency(accrued)}</strong></div><div><span>Deducciones</span><strong>{currency(deductions)}</strong></div><div><span>Neto a pagar</span><strong>{currency(money(cents(accrued) - cents(deductions)))}</strong></div></div>
        <div className="payroll-adjustment-modal__fields">
          <label>Fecha del ajuste *<input type="date" value={draft.state.issueDate} disabled={busy || locked} onChange={event => update({ issueDate: event.target.value })} required /></label>
          <label>Motivo del ajuste *<input value={draft.state.notes ?? ''} maxLength={2000} disabled={busy || locked} onChange={event => update({ notes: event.target.value })} placeholder="Describe por qué necesitas corregir o anular este envío" required /></label>
        </div>
        <p className="payroll__muted">El sistema toma automáticamente la referencia del documento aceptado y asigna el consecutivo de la nota de ajuste.</p>
        <div className="payroll-employee-modal__table"><table><thead><tr><th>Concepto</th><th>Ingresos</th><th>Deducciones</th></tr></thead><tbody>
          {lines.slice((currentPage - 1) * pageSize, currentPage * pageSize).map(line => <tr key={line.id}><td>{draft.parameter_snapshot.concepts.find(concept => concept.code === line.concept)?.name ?? concepts.find(concept => concept.code === line.concept)?.name ?? 'Novedad de nómina'}</td><td>{line.kind === 'accrued' ? currency(line.amount) : ''}</td><td>{line.kind === 'deduction' ? currency(line.amount) : ''}</td></tr>)}
        </tbody></table></div>
        {shouldShowTablePagination(lines.length, pageSize) && <nav className="payroll__pagination" aria-label="Páginas de novedades del ajuste"><button className="payroll__button" disabled={busy || currentPage === 1} onClick={() => setPage(currentPage - 1)}>Anterior</button><span>{currentPage} / {pages}</span><button className="payroll__button" disabled={busy || currentPage === pages} onClick={() => setPage(currentPage + 1)}>Siguiente</button></nav>}
        {result && <div className={`payroll__notice${result.status === 'REJECTED' ? ' payroll__notice--error' : ''}`} role="status">
          {result.status === 'ACCEPTED' ? noteType === 2 ? 'La DIAN aceptó la anulación de este envío.' : 'La DIAN aceptó el reemplazo de la nómina.' : `Ajuste: ${statusLabels[result.status] ?? 'Pendiente de confirmación'}.`}
          {result.noteDocumentCredit && result.noteDocumentCredit !== 'APPLIED' && <p>El abono de un documento en NextPyme requiere revisión. No vuelvas a enviar el ajuste.</p>}
          {messages.length > 0 && <ul>{messages.map(message => <li key={message}>{message}</li>)}</ul>}
        </div>}
        <div className="payroll__toolbar">
          {noteType === 1 && <button className="payroll__button" disabled={busy || locked} onClick={() => setEditing(true)}>Gestionar novedades</button>}
          {!locked && <button className={`payroll__button payroll__button--${noteType === 2 ? 'danger' : 'primary'}`} disabled={busy || !draft.state.issueDate || !draft.state.notes?.trim()} onClick={() => void send()}>{noteType === 2 ? 'Anular envío de la DIAN' : 'Enviar reemplazo a la DIAN'}</button>}
          {result && ['PROCESSING', 'UNCERTAIN'].includes(result.status) && <button className="payroll__button" disabled={busy} onClick={() => void checkStatus()}>Verificar estado del ajuste</button>}
        </div>
      </>}
    </Modal>
    {editing && draft && <PayrollNoveltyModal detail={draft} concepts={concepts} busy={busy} deferred onClose={() => setEditing(false)} onSave={async state => { setDraft(previous => previous ? { ...previous, state } : previous); setResult(null) }} />}
    <DocumentSendOverlay open={busy} documentTitle={noteType === 2 ? 'anulación de nómina' : 'reemplazo de nómina'} />
  </>
}
import { formatJarvisDocumentNumber } from '../../utils/jarvisDocumentNumber'
