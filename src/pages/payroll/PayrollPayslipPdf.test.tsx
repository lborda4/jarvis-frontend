import { describe, expect, it } from 'vitest'
import { renderToBuffer } from '@react-pdf/renderer'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { PayrollDetail } from '../../services/payrollService'
import { blankEmployee, blankParameters, blankPayroll } from './payrollDefaults'
import { PayrollPayslipPdf } from './PayrollPayslipPdf'

const detail = {
  id: 'payroll', state: { ...blankPayroll('2026-03'), startDate: '2026-03-16', endDate: '2026-03-30', lines: [
    { id: 'salary', concept: 'salary', kind: 'accrued', quantity: '15', amount: '875453.01' },
    { id: 'transport', concept: 'transportation_allowance', kind: 'accrued', quantity: '15', amount: '124548.02' },
    { id: 'eps', concept: 'eps', kind: 'deduction', quantity: '1', amount: '35100.01' },
  ] }, employee_snapshot: { ...blankEmployee(), firstName: 'Ana', surname: 'Pérez', identification: '12345', salary: '1750905' },
  parameter_snapshot: blankParameters('2026-01-01'), status: 'DRAFT', number: null, prefix: null, cune: null, files: [], transmissions: [],
} as PayrollDetail

async function readPdf(data: PayrollDetail) {
  const buffer = await renderToBuffer(<PayrollPayslipPdf detail={data} company={{ name: 'Empresa de ejemplo', nit: '900123456' }} position="Asesora comercial" />)
  const pdf = await getDocument({ data: new Uint8Array(buffer), useSystemFonts: true }).promise
  try {
    const text = (await (await pdf.getPage(1)).getTextContent()).items.map(item => 'str' in item ? item.str : '').join(' ')
    return { pages: pdf.numPages, text }
  } finally { await pdf.destroy() }
}

describe('Desprendible de nómina por empleado', () => {
  it('genera una página con identificación, período, conceptos y totales exactos', async () => {
    const result = await readPdf(detail)
    expect(result.pages).toBe(1)
    for (const text of ['Empresa de ejemplo', '900123456', 'Ana Pérez', '12345', 'Asesora comercial', '16/03/2026', '30/03/2026', 'Auxilio de transporte', 'INGRESOS', 'DEDUCCIONES', '1.000.001,03', '35.100,01', '964.901,02']) expect(result.text).toContain(text)
    expect(result.text).not.toContain('Siigo')
    expect(result.text).not.toContain('Comprobante:')
  }, 30000)
  it('puede generar un desprendible sin novedades y con neto cero', async () => {
    const result = await readPdf({ ...detail, state: { ...detail.state, lines: [] } })
    expect(result.pages).toBe(1)
    expect(result.text).toContain('NETO A PAGAR')
    expect(result.text).toContain('0,00')
  }, 30000)
})
