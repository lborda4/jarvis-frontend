import { useEffect, useId, useState } from 'react'
import Modal from '../../components/Modal'
import { payrollService, type PayrollDetail, type PayrollDocument, type PayrollState } from '../../services/payrollService'
import { getApiErrorMessage } from '../../services/apiClient'
import { employeeName, localDate } from './payrollDefaults'
import type { PayrollContext } from './PayrollPage'
import { canEditPayrollNovelties } from './payrollNoveltyDomain'
import PayrollNoveltyModal from './PayrollNoveltyModal'
import { usePayrollNoveltyDrafts } from './usePayrollNoveltyDrafts'
import './PayrollNovelties.css'

export default function PayrollPeriodNoveltiesModal({ documents, context, onReload, onClose }: {
  documents: PayrollDocument[]; context: PayrollContext; onReload: () => Promise<void>; onClose: () => void;
}) {
  const titleId = useId()
  const [selectedId] = useState(() => documents.find(canEditPayrollNovelties)?.id ?? documents[0]?.id ?? '')
  const selected = documents.find(document => document.id === selectedId)
  const { drafts, dirty, stage, clear } = usePayrollNoveltyDrafts([selectedId])
  const [loaded, setLoaded] = useState<PayrollDetail | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [saving, setSaving] = useState(false)
  const busy = context.busy || saving
  const editable = selected && canEditPayrollNovelties(selected)
  const detail = drafts[selectedId] ?? (loaded?.id === selectedId ? loaded : null)
  useEffect(() => {
    if (!selectedId || !editable) return
    let active = true
    void payrollService.get(selectedId).then(detail => { if (active) setLoaded(detail) }).catch(error => {
      if (active) setError(getApiErrorMessage(error, 'No se pudieron cargar las novedades del empleado.'))
    })
    return () => { active = false }
  }, [selectedId, editable, attempt])
  const save = async (state: PayrollState) => {
    if (!detail || !editable) throw new Error('Este empleado no admite cambios en el período.')
    stage(detail, state)
  }
  const commit = async () => {
    if (!detail || !editable || !dirty || saving) return
    setError('')
    setSaving(true)
    try {
      await payrollService.saveBatch([{ id: detail.id, state: detail.state, updatedAt: detail.updated_at ?? selected.updatedAt }])
      clear([detail.id])
      onClose()
      void onReload().catch(() => {})
    } catch (error) {
      setError(getApiErrorMessage(error, 'No se pudo guardar el período. Tus cambios se conservan para reintentar.'))
    } finally { setSaving(false) }
  }
  const configured = [...context.data.parameters].sort((a, b) => b.validFrom.localeCompare(a.validFrom)).find(parameter => parameter.validFrom <= localDate())
  if (editable && detail && canEditPayrollNovelties(detail)) return <PayrollNoveltyModal key={detail.id} detail={detail}
    concepts={configured?.data.concepts ?? detail.parameter_snapshot.concepts} busy={busy}
    deferred footer={<>
      {error && <p className="payroll__notice payroll__notice--error" role="alert">{error}</p>}
      <div className="payroll__toolbar payroll__novelty-actions"><button type="button" className="payroll__button payroll__button--primary" disabled={busy || !dirty} onClick={() => void commit()}>{saving ? 'Guardando período…' : 'Guardar período'}</button></div>
    </>}
    onClose={() => { if (!busy) onClose() }} onSave={save} />
  return <Modal isOpen busy={busy} labelledBy={titleId} onClose={onClose}>
    <h2 className="modal-dialog__title" id={titleId}>Registrar novedades de nómina</h2>
    {selected && <p className="payroll__muted">{employeeName(selected.employee)} · {selected.employee.identification}</p>}
    {!editable || (detail && !canEditPayrollNovelties(detail)) ? <p className="payroll__notice">No se pueden modificar las novedades de este empleado porque su nómina ya se envió o está pendiente de confirmación.</p>
      : error ? <div className="payroll__notice payroll__notice--error" role="alert">{error} <button className="payroll__link" onClick={() => { setError(''); setAttempt(attempt + 1) }}>Reintentar</button></div>
        : <p role="status">Cargando novedades del empleado…</p>}
  </Modal>
}
