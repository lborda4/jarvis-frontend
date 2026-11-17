import type { PayrollDocument } from '../../services/payrollService'
import { payrollPeriodKey } from './payrollPeriods'

export function payrollDuplicatePeriod(documents: PayrollDocument[], sourceId: string) {
  const source = documents.find(document => document.id === sourceId && !document.originalId)
  return source ? documents.filter(document => !document.originalId && payrollPeriodKey(document) === payrollPeriodKey(source)) : []
}
