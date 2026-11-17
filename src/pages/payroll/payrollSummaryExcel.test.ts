import { expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { payrollSummaryWorkbook } from './payrollSummaryExcel'
import { blankEmployee, blankPayroll } from './payrollDefaults'
import type { PayrollDocument } from '../../services/payrollService'

function document(id: string, accrued: string, deductions: string, net: string): PayrollDocument {
  return { id, employeeId: id, employee: { ...blankEmployee(), firstName: 'Ana', surname: 'Pérez', identification: '00123' },
    state: { ...blankPayroll('2026-01'), startDate: '2026-01-01', endDate: '2026-01-15', payrollName: 'Primera quincena' },
    originalId: null, status: 'ACCEPTED', prefix: 'NI', number: 'NI6', cune: 'cune', accrued, deductions, net, updatedAt: '' }
}
it('exporta el período por empleado con valores numéricos, identificación íntegra y totales', () => {
  const book = payrollSummaryWorkbook([document('ana', '1040000.25', '125000.10', '915000.15'), document('luis', '100.15', '10.05', '90.10')])
  const sheet = book.Sheets[book.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet)
  expect(rows).toHaveLength(3)
  expect(rows[0]).toMatchObject({ Documento: 'NI6', Identificación: '00123', Nómina: 'Primera quincena', 'Fecha inicial': '2026-01-01', 'Fecha final': '2026-01-15', Ingresos: 1040000.25, Deducciones: 125000.10, 'Neto a pagar': 915000.15, Estado: 'Aceptada' })
  expect(rows[2]).toMatchObject({ Empleado: 'TOTAL', Ingresos: 1040100.40, Deducciones: 125010.15, 'Neto a pagar': 915090.25 })
  expect(sheet.G2.t).toBe('n')
  expect(sheet.G2.z).toBe('#,##0.00')
})
it('usa la referencia mensual aceptada sin sustituir los valores de la quincena', () => {
  const source = document('ana', '1000', '100', '900')
  source.prefix = null; source.number = null; source.status = 'DRAFT'
  source.monthlySubmission = { id: 'monthly', prefix: 'NI', number: '6', status: 'ACCEPTED', cune: 'cune' }
  const book = payrollSummaryWorkbook([source])
  expect(XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]])[0]).toMatchObject({ Documento: 'NI6', Ingresos: 1000, 'Neto a pagar': 900, Estado: 'Aceptada' })
})
