import { describe, expect, it } from 'vitest'
import { duplicateInvoicePrefill, duplicatePayrollState, movePayrollStatePeriod } from './documentDuplication'
import type { JarvisInvoiceDetail } from '../services/jarvisService'
import type { PayrollState } from '../services/payrollService'

const invoice: JarvisInvoiceDetail = {
  id: 'original', providerId: '1', number: '21', prefix: 'FE', issueDate: '2026-10-06',
  customerName: 'Cliente', customerIdentification: '123', currency: 'COP', total: '214.20',
  cufe: 'original-cufe', status: 'SENT', sentAt: '2026-10-06',
  sourceRequest: {
    number: 21, prefix: 'FE', issueDate: '2026-10-06', customerDocumentType: 'NIT', customerIdentification: '123',
    observations: 'Servicio mensual', headNote: 'Encabezado', footNote: 'Pie', sellerIds: ['seller'],
    attachmentDraftId: 'old-draft', billingReference: { number: 'FE1', uuid: 'old', issueDate: '2026-01-01' },
    items: [{ code: 'ABC', description: 'Servicio', quantity: 2, unitValue: 100, discount: 20, taxAmount: 34.2, taxId: 1, notes: 'Detalle', retention: { id: 6, type: 'ReteRenta', percentage: 2.5 } }],
    retentions: [{ id: 7, type: 'ReteICA', percentage: 4.14 }],
    payment: { id: 10, payment_form_id: 2, due_date: '2026-11-05' },
    paymentBreakdown: [
      { methodId: 'cash', methodName: 'Efectivo', nextpymeMethodId: 1, negotiation: 'CASH', amount: 100 },
      { methodId: 'credit', methodName: 'Crédito', nextpymeMethodId: 10, negotiation: 'CREDIT', amount: 114.2 },
    ],
  },
}

describe('duplicar factura o documento soporte', () => {
  it('conserva los datos y el plazo sin reutilizar consecutivos, referencias ni adjuntos del original', () => {
    const original = structuredClone(invoice)
    const copy = duplicateInvoicePrefill(invoice, [], '2026-11-06')
    expect(copy.request).toMatchObject({ issueDate: '2026-11-06', observations: 'Servicio mensual', headNote: 'Encabezado', footNote: 'Pie', sellerIds: ['seller'], payment: { due_date: '2026-12-06' } })
    expect(copy.request.items).toEqual(invoice.sourceRequest!.items)
    expect(copy.request.paymentBreakdown).toEqual(invoice.sourceRequest!.paymentBreakdown)
    expect(copy.lines[0]).toMatchObject({ quantity: '2', unitValue: '100', discount: '20', taxPercent: '19', notes: 'Detalle' })
    expect(copy.taxes.find(tax => tax.id === copy.reteIcaId)?.percentage).toBe(4.14)
    expect(copy.request).not.toHaveProperty('number')
    expect(copy.request).not.toHaveProperty('prefix')
    expect(copy.request).not.toHaveProperty('billingReference')
    expect(copy.request).not.toHaveProperty('attachmentDraftId')
    expect(copy).not.toHaveProperty('billingUuid')
    copy.request.items[0].description = 'Modificado'
    expect(invoice).toEqual(original)
  })
  it('actualiza también el vencimiento de contado y rechaza documentos sin detalle', () => {
    const cash = { ...invoice, sourceRequest: { ...invoice.sourceRequest!, payment: { id: 1, payment_form_id: 1, due_date: invoice.issueDate } } }
    expect(duplicateInvoicePrefill(cash, [], '2026-11-06').request.payment?.due_date).toBe('2026-11-06')
    expect(() => duplicateInvoicePrefill({ ...invoice, sourceRequest: null }, [], '2026-11-06')).toThrow('no tiene el detalle')
  })
})

describe('duplicar nómina', () => {
  const state: PayrollState = {
    payrollName: 'Administración', payrollGroupId: 'old-group', periodicity: 'MONTHLY', employeeId: 'employee',
    period: '2026-10', startDate: '2026-10-01', endDate: '2026-10-31', issueDate: '2026-10-31',
    workedDays: '30', paymentDates: ['2026-10-31'], originalId: 'old-original', noteType: 1,
    lines: [{ id: 'old-line', concept: 'salary', kind: 'accrued', amount: '2000000', quantity: '30' },
      { id: 'old-vacation', concept: 'vacation', kind: 'accrued', amount: '100000', quantity: '2', startDate: '2026-10-30', endDate: '2026-10-31' }],
  }
  it('abre una nueva nómina editable con los importes anteriores y fechas del mes actual', () => {
    const original = structuredClone(state)
    const copy = duplicatePayrollState(state, '2026-11-06')
    expect(copy).toMatchObject({ employeeId: 'employee', payrollName: 'Administración', period: '2026-11', startDate: '2026-11-01', endDate: '2026-11-30', issueDate: '2026-11-06', paymentDates: ['2026-11-06'], workedDays: '30' })
    expect(copy).not.toHaveProperty('originalId')
    expect(copy).not.toHaveProperty('noteType')
    expect(copy).not.toHaveProperty('payrollGroupId')
    expect(copy.lines[0]).toMatchObject({ amount: '2000000', quantity: '30' })
    expect(copy.lines[0].id).not.toBe(state.lines[0].id)
    expect(copy.lines[1].endDate).toBe('2026-11-30')
    copy.lines[0].amount = '1'
    expect(state).toEqual(original)
  })
  it('respeta la quincena y los límites de febrero', () => {
    expect(duplicatePayrollState({ ...state, periodicity: 'SECOND_HALF' }, '2028-02-03')).toMatchObject({ startDate: '2028-02-16', endDate: '2028-02-29' })
  })
  it('permite elegir otro período conservando días, importes y fechas de emisión de la copia', () => {
    const copy = duplicatePayrollState({ ...state, periodicity: 'FIRST_HALF', workedDays: '15' }, '2026-11-06')
    expect(movePayrollStatePeriod(copy, '2026-12')).toMatchObject({ period: '2026-12', startDate: '2026-12-01', endDate: '2026-12-15', workedDays: '15', issueDate: '2026-11-06' })
  })
  it('reconoce meses completos antiguos y conserva novedades que cruzan de mes', () => {
    const old = { ...state, periodicity: undefined, period: '2026-02', startDate: '2026-02-01', endDate: '2026-02-28', lines: [{ ...state.lines[1], startDate: '2026-02-28', endDate: '2026-03-02' }] }
    const copy = duplicatePayrollState(old, '2026-03-06')
    expect(copy.endDate).toBe('2026-03-31')
    expect(copy.lines[0]).toMatchObject({ startDate: '2026-03-28', endDate: '2026-04-02' })
  })
})
