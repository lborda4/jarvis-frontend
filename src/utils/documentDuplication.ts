import type { JarvisInvoiceDetail } from '../services/jarvisService'
import type { PayrollState } from '../services/payrollService'
import { creditNotePrefill } from './creditNotePrefill'
import type { SalesInvoiceTaxOption } from './salesInvoiceTaxes'
import { addDaysToLocalDate, daysBetweenLocalDates } from './supportDocumentDate'
import { payrollPeriodBounds } from './payrollPeriod'

export function duplicateInvoicePrefill(invoice: JarvisInvoiceDetail, taxes: SalesInvoiceTaxOption[], today: string) {
  if (!invoice.sourceRequest?.items.length)
    throw new Error('Este documento antiguo no tiene el detalle guardado y no se puede duplicar.')
  const original = invoice.sourceRequest
  // Copy business data only. Numbering, references and authorization belong to the new document.
  const request = {
    issueDate: today,
    customerDocumentType: original.customerDocumentType,
    customerIdentification: original.customerIdentification,
    customerName: original.customerName,
    currency: original.currency,
    observations: original.observations,
    headNote: original.headNote,
    footNote: original.footNote,
    items: structuredClone(original.items),
    retentions: structuredClone(original.retentions),
    sellerIds: original.sellerIds?.slice(),
    paymentBreakdown: structuredClone(original.paymentBreakdown),
    payment: original.payment ? {
      ...original.payment,
      due_date: addDaysToLocalDate(today, Math.max(0, daysBetweenLocalDates(original.issueDate, original.payment.due_date ?? original.issueDate))),
    } : undefined,
  }
  const prefill = creditNotePrefill({ ...invoice, sourceRequest: request }, taxes)
  return { request, lines: prefill.lines, taxes: prefill.taxes, reteIcaId: prefill.reteIcaId, reteIvaId: prefill.reteIvaId }
}

export function movePayrollStatePeriod(original: PayrollState, period: string): PayrollState {
  const state = structuredClone(original)
  const moveDate = (date: string) => {
    // Preserve relative months for novelties that cross a month boundary.
    const offset = (Number(period.slice(0, 4)) - Number(state.period.slice(0, 4))) * 12
      + Number(period.slice(5, 7)) - Number(state.period.slice(5, 7))
    const shifted = new Date(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1 + offset, 1))
    const target = shifted.toISOString().slice(0, 7)
    const last = Number(payrollPeriodBounds(target, 'MONTHLY').endDate.slice(-2))
    return `${target}-${String(Math.min(Number(date.slice(-2)), last)).padStart(2, '0')}`
  }
  const previousMonthEnd = payrollPeriodBounds(state.period, 'MONTHLY').endDate
  const periodicity = state.periodicity ?? (
    state.startDate.endsWith('-01') && state.endDate === previousMonthEnd ? 'MONTHLY'
      : state.startDate.endsWith('-16') && state.endDate === previousMonthEnd ? 'SECOND_HALF'
        : state.startDate.endsWith('-01') && state.endDate.endsWith('-15') ? 'FIRST_HALF' : undefined
  )
  const bounds = periodicity
    ? payrollPeriodBounds(period, periodicity)
    : { startDate: moveDate(state.startDate), endDate: moveDate(state.endDate) }
  return {
    ...state, ...bounds, period,
    lines: state.lines.map(line => ({
      ...line,
      ...(line.startDate ? { startDate: moveDate(line.startDate) } : {}),
      ...(line.endDate ? { endDate: moveDate(line.endDate) } : {}),
    })),
  }
}

export function duplicatePayrollState(original: PayrollState, today: string): PayrollState {
  const state = movePayrollStatePeriod(original, today.slice(0, 7))
  delete state.originalId
  delete state.noteType
  delete state.payrollGroupId
  return {
    ...state, issueDate: today,
    paymentDates: state.paymentDates.map(() => today),
    lines: state.lines.map(line => ({ ...line, id: crypto.randomUUID() })),
  }
}
