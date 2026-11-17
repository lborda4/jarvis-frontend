import * as XLSX from 'xlsx'
import type { PayrollDocument } from '../../services/payrollService'
import { cents, money } from '../../utils/payrollDomain'
import { employeeName, statusLabels } from './payrollDefaults'

export function payrollSummaryWorkbook(documents: PayrollDocument[]) {
  const rows = documents.map(document => {
    const submission = document.monthlySubmission ?? document
    const prefix = submission.prefix ?? ''
    const number = submission.number ?? ''
    return {
      Documento: number.startsWith(prefix) ? number : `${prefix}${number}`,
      Empleado: employeeName(document.employee),
      Identificación: document.employee.identification,
      Nómina: document.state.payrollName ?? '',
      'Fecha inicial': document.state.startDate,
      'Fecha final': document.state.endDate,
      Ingresos: Number(document.accrued),
      Deducciones: Number(document.deductions),
      'Neto a pagar': Number(document.net),
      Estado: statusLabels[submission.status] ?? submission.status,
    }
  })
  const sheet = XLSX.utils.json_to_sheet(rows)
  if (documents.length) {
    const total = (field: 'accrued' | 'deductions' | 'net') => Number(money(documents.reduce((sum, document) => sum + cents(document[field]), 0n)))
    XLSX.utils.sheet_add_aoa(sheet, [['', 'TOTAL', '', '', '', '', total('accrued'), total('deductions'), total('net')]], { origin: -1 })
    for (let row = 2; row <= documents.length + 2; row++) {
      for (const column of ['G', 'H', 'I']) if (sheet[`${column}${row}`]) sheet[`${column}${row}`].z = '#,##0.00'
    }
  }
  sheet['!cols'] = [18, 40, 20, 30, 16, 16, 20, 20, 20, 18].map(wch => ({ wch }))
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, 'Resumen de nómina')
  return book
}

export function exportPayrollSummary(documents: PayrollDocument[], fallbackPeriod: string) {
  const start = documents.map(document => document.state.startDate).sort()[0]
  const end = documents.map(document => document.state.endDate).sort().at(-1)
  XLSX.writeFile(payrollSummaryWorkbook(documents), `Nomina-${start && end ? `${start}-a-${end}` : fallbackPeriod}.xlsx`)
}
