import type { PayrollMonth } from './payrollMonths'
import type { PayrollDocument } from '../../services/payrollService'

export function payrollAdjustmentLabel(adjustment: PayrollDocument['adjustment']) {
  if (!adjustment) return ''
  const operation = adjustment.noteType === 2 ? 'Anulación' : 'Reemplazo'
  return adjustment.status === 'ACCEPTED' ? adjustment.noteType === 2 ? 'Anulación aceptada' : 'Reemplazo aceptado'
    : adjustment.status === 'REJECTED' ? `${operation} con errores`
      : adjustment.status === 'DRAFT' ? `${operation} sin enviar` : `${operation} por confirmar`
}

export function payrollAdjustmentTargets(month: PayrollMonth) {
  const seen = new Set<string>()
  return month.documents.filter(document => {
    if (document.originalId) return false
    const id = document.monthlySubmission?.id ?? document.id
    if (seen.has(id) || (document.monthlySubmission?.status ?? document.status) !== 'ACCEPTED') return false
    seen.add(id)
    return true
  }).map(document => ({
    id: document.monthlySubmission?.id ?? document.id,
    originalId: document.adjustmentTargetId === undefined ? document.monthlySubmission?.id ?? document.id : document.adjustmentTargetId,
    document,
  }))
}
