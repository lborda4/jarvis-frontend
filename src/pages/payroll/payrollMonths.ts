import type { PayrollDocument } from '../../services/payrollService'
import { cents, money } from '../../utils/payrollDomain'
import { periodLabel } from './payrollPeriods'

export function payrollMonthTotals(documents: PayrollDocument[]) {
  const accrued = documents.reduce((sum, d) => sum + cents(d.accrued), 0n)
  const deductions = documents.reduce((sum, d) => sum + cents(d.deductions), 0n)
  return { accrued: money(accrued), deductions: money(deductions), net: money(accrued - deductions) }
}

export function groupPayrollMonths(documents: PayrollDocument[]) {
  const groups = new Map<string, PayrollDocument[]>()
  for (const document of documents) {
    const key = document.state.startDate.slice(0, 7)
    groups.set(key, [...(groups.get(key) ?? []), document])
  }
  return [...groups].sort(([a], [b]) => b.localeCompare(a)).map(([key, items]) => {
    // Adjustment notes remain in history; they must not be added to the original payroll again.
    const originals = items.filter(document => !document.originalId)
    const employees = new Map<string, PayrollDocument[]>()
    for (const document of originals)
      employees.set(document.employeeId, [...(employees.get(document.employeeId) ?? []), document])
    const warnings: string[] = []
    for (const rows of employees.values()) {
      const sorted = [...rows].sort((a, b) => a.state.startDate.localeCompare(b.state.startDate))
      if (sorted.some((row, index) => sorted.slice(0, index).some(previous => previous.state.endDate >= row.state.startDate))) {
        warnings.push('Hay períodos superpuestos para un mismo empleado. Revisa que no estés contando una nómina dos veces.')
        break
      }
    }
    const missingHalf = [...employees.values()].some(rows => {
      const first = rows.some(d => d.state.startDate === `${key}-01` && d.state.endDate === `${key}-15`)
      const second = rows.some(d => d.state.startDate === `${key}-16` && d.state.endDate.slice(0, 7) === key)
      return first !== second
    })
    if (missingHalf) warnings.push('Hay empleados con una sola quincena registrada. Revisa si falta la otra o si ingresaron o se retiraron durante el mes.')
    if (originals.some(d => d.state.endDate.slice(0, 7) !== key)) warnings.push('Hay períodos que abarcan más de un mes. Revisa su distribución antes de consolidar.')
    if (items.some(d => d.originalId)) warnings.push('Las notas de ajuste se muestran en el historial y están excluidas de este acumulado preliminar.')
    const hasPreviousSend = originals.some(d => !d.monthlySubmission && (d.number || d.cune || ['ACCEPTED', 'PROCESSING', 'UNCERTAIN'].includes(d.status)))
    if (hasPreviousSend) warnings.push('Hay envíos anteriores en este mes. Deben revisarse antes de generar un documento mensual para evitar duplicados.')
    const hasErrors = originals.some(d => ['REJECTED', 'UNCERTAIN'].includes(d.status))
    const accepted = originals.length > 0 && originals.every(d => d.monthlySubmission?.status === 'ACCEPTED')
    const partial = originals.some(d => d.monthlySubmission?.status === 'ACCEPTED')
    const processing = originals.some(d => ['PROCESSING', 'UNCERTAIN'].includes(d.monthlySubmission?.status ?? ''))
    return { key, label: periodLabel(key), documents: items, employees: [...employees].map(([id, rows]) => ({ id, employee: rows[0].employee, documents: rows,
        submission: rows.find(row => row.monthlySubmission)?.monthlySubmission,
        status: rows.find(row => ['REJECTED', 'UNCERTAIN', 'PROCESSING', 'ACCEPTED'].includes(row.status))?.status ?? 'DRAFT',
        errors: [...new Set(rows.flatMap(row => row.submissionErrors ?? []))], ...payrollMonthTotals(rows) })),
      ...payrollMonthTotals(originals), warnings, status: hasErrors ? 'REJECTED' : accepted ? 'ACCEPTED' : processing || partial ? 'PROCESSING' : 'DRAFT',
      statusLabel: hasErrors ? 'Con errores' : accepted ? 'Aceptada' : processing ? 'Por confirmar' : partial ? 'Envío parcial' : hasPreviousSend ? 'Con envíos previos' : 'Pendiente de envío' }
  })
}
export type PayrollMonth = ReturnType<typeof groupPayrollMonths>[number]
