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
    const pageTexts: string[] = []
    for (let number = 1; number <= pdf.numPages; number++) {
      const text = (await (await pdf.getPage(number)).getTextContent()).items.map(item => 'str' in item ? item.str : '').join(' ')
      pageTexts.push(text)
    }
    return { pages: pdf.numPages, text: pageTexts.join(' '), pageTexts }
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
  it('muestra fecha de pago y consecutivo sin duplicar el prefijo', async () => {
    for (const number of ['27', 'NI27']) {
      const result = await readPdf({ ...detail, number, prefix: 'NI', state: { ...detail.state, paymentDates: ['2026-03-31'] } })
      expect(result.text).toContain('31/03/2026')
      expect(result.text).toContain('NI27')
      expect(result.text).not.toContain('NINI27')
    }
  }, 30000)
  it('conserva los conceptos largos y repite identificación y columnas al continuar en otra página', async () => {
    const lines = Array.from({ length: 45 }, (_, index) => ({
      id: `line-${index}`, concept: 'salary', kind: 'accrued' as const, quantity: '1', amount: '1000.01',
      description: `Detalle ${String(index).padStart(2, '0')} de una novedad de nómina con explicación completa del concepto liquidado`,
    }))
    const result = await readPdf({ ...detail, state: { ...detail.state, lines } })
    expect(result.pages).toBeGreaterThan(1)
    for (const text of result.pageTexts) {
      for (const heading of ['Ana Pérez', 'CONCEPTO', 'INGRESOS', 'DEDUCCIONES']) expect(text).toContain(heading)
    }
    for (let index = 0; index < lines.length; index++) expect(result.text).toContain(`Detalle ${String(index).padStart(2, '0')}`)
    expect(result.text.match(/NETO A PAGAR/g)).toHaveLength(1)
    expect(result.pageTexts.at(-1)).toContain('45.000,45')
  }, 60000)
})
