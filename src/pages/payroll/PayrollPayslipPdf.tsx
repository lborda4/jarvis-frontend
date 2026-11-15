import { Document, Page, StyleSheet, Text, View, pdf } from '@react-pdf/renderer'
import type { AuthCompany } from '../../types/auth'
import type { PayrollDetail } from '../../services/payrollService'
import { totals } from '../../utils/payrollDomain'
import { payrollQuantity } from '../../utils/payrollQuantity'
import { disablePdfHyphenation } from '../../utils/pdfTextWrap'
import { currency, employeeName } from './payrollDefaults'

disablePdfHyphenation()

// PDF styles use literal print values because the renderer does not support CSS variables.
const styles = StyleSheet.create({
  page: { padding: 30, fontFamily: 'Helvetica', fontSize: 9, color: '#16335b' },
  frame: { border: '0.7 solid #cbd9e6', padding: 18 },
  title: { fontSize: 17, textAlign: 'center', fontFamily: 'Helvetica-Bold', marginBottom: 24 },
  header: { flexDirection: 'row', justifyContent: 'space-between', gap: 20, marginBottom: 22 },
  company: { width: '40%' }, companyName: { fontFamily: 'Helvetica-Bold', fontSize: 14, marginBottom: 6 },
  employee: { flex: 1, textAlign: 'right' }, field: { marginBottom: 5 },
  table: { border: '0.5 solid #cbd9e6' }, row: { flexDirection: 'row' },
  heading: { width: '50%', textAlign: 'center', backgroundColor: '#e0f4f3', padding: 7, fontFamily: 'Helvetica-Bold' },
  half: { width: '50%', flexDirection: 'row' },
  cell: { border: '0.3 solid #cbd9e6', padding: 5, minWidth: 0 },
  concept: { width: '48%' }, quantity: { width: '17%', textAlign: 'right' }, value: { width: '35%', textAlign: 'right' },
  labels: { backgroundColor: '#f3f8fb', fontSize: 8, fontFamily: 'Helvetica-Bold' },
  totalLabel: { width: '65%', textAlign: 'right', fontFamily: 'Helvetica-Bold' },
  totalValue: { width: '35%', textAlign: 'right', fontFamily: 'Helvetica-Bold' },
  net: { flexDirection: 'row', alignSelf: 'flex-end', width: '50%', marginTop: 14, backgroundColor: '#e0f4f3', fontFamily: 'Helvetica-Bold' },
  netLabel: { width: '50%', padding: 8 }, netValue: { width: '50%', padding: 8, textAlign: 'right' },
  footer: { marginTop: 24, fontSize: 8, textAlign: 'center', color: '#475569' },
  pageNumber: { position: 'absolute', bottom: 16, right: 30, fontSize: 8, color: '#475569' },
})

export interface PayrollPayslipProps {
  detail: PayrollDetail
  company: Pick<AuthCompany, 'name' | 'nit'>
  position?: string
}

export function PayrollPayslipPdf({ detail, company, position }: PayrollPayslipProps) {
  const { state, employee_snapshot: employee, parameter_snapshot: parameters } = detail
  const accrued = state.lines.filter(line => line.kind === 'accrued')
  const deductions = state.lines.filter(line => line.kind === 'deduction')
  const total = totals(state.lines)
  const date = (value: string) => value.split('-').reverse().join('/')
  const label = (line: typeof state.lines[number]) => {
    const name = parameters.concepts.find(concept => concept.code === line.concept && concept.kind === line.kind)?.name ?? line.concept
    return line.description?.trim() ? `${name}: ${line.description.trim()}` : name
  }
  const cells = (line?: typeof state.lines[number]) => <View style={styles.half}>
    <Text style={[styles.cell, styles.concept]}>{line ? label(line) : ''}</Text>
    <Text style={[styles.cell, styles.quantity]}>{payrollQuantity(line?.quantity ?? '')}</Text>
    <Text style={[styles.cell, styles.value]}>{line ? currency(line.amount) : ''}</Text>
  </View>
  return <Document title={`Desprendible de nómina - ${employeeName(employee)} - ${state.startDate}`} author={company.name}>
    <Page size="A4" style={styles.page}>
      <View style={styles.frame}>
        <Text style={styles.title}>Comprobante de nómina</Text>
        <View style={styles.header} wrap={false}>
          <View style={styles.company}><Text style={styles.companyName}>{company.name}</Text>{company.nit && <Text>NIT: {company.nit}</Text>}</View>
          <View style={styles.employee}>
            <Text style={styles.field}>Período de pago: {date(state.startDate)} - {date(state.endDate)}</Text>
            {state.payrollName && <Text style={styles.field}>Nómina: {state.payrollName}</Text>}
            {detail.number && <Text style={styles.field}>Comprobante: {detail.prefix ?? ''}{detail.number}</Text>}
            <Text style={styles.field}>Nombre: {employeeName(employee)}</Text>
            <Text style={styles.field}>Identificación: {employee.identification}</Text>
            {position && <Text style={styles.field}>Cargo: {position}</Text>}
            <Text style={styles.field}>Salario básico: {currency(employee.salary)}</Text>
          </View>
        </View>
        <View style={styles.table}>
          <View style={styles.row} wrap={false}><Text style={styles.heading}>INGRESOS</Text><Text style={styles.heading}>DEDUCCIONES</Text></View>
          <View style={[styles.row, styles.labels]} wrap={false}>{[0, 1].map(index => <View key={index} style={styles.half}>
            <Text style={[styles.cell, styles.concept]}>Concepto</Text><Text style={[styles.cell, styles.quantity]}>Cantidad</Text><Text style={[styles.cell, styles.value]}>Valor</Text>
          </View>)}</View>
          {Array.from({ length: Math.max(accrued.length, deductions.length, 1) }, (_, index) => <View key={index} style={styles.row} wrap={false}>{cells(accrued[index])}{cells(deductions[index])}</View>)}
          <View style={styles.row} wrap={false}>{[['Total ingresos', total.accrued], ['Total deducciones', total.deductions]].map(([name, amount]) => <View key={name} style={styles.half}>
            <Text style={[styles.cell, styles.totalLabel]}>{name}</Text><Text style={[styles.cell, styles.totalValue]}>{currency(amount)}</Text>
          </View>)}</View>
        </View>
        <View style={styles.net} wrap={false}><Text style={styles.netLabel}>NETO A PAGAR</Text><Text style={styles.netValue}>{currency(total.net)}</Text></View>
        <Text style={styles.footer}>Comprobante elaborado con Jarvis Colombia.</Text>
      </View>
      <Text style={styles.pageNumber} fixed render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </Page>
  </Document>
}

export function generatePayrollPayslip(props: PayrollPayslipProps) {
  return pdf(<PayrollPayslipPdf {...props} />).toBlob()
}
