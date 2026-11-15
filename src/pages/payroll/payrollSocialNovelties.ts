import type { PayrollLine } from '../../utils/payrollDomain'
import { payrollSocialDeductions, type PayrollSocialDeduction } from './payrollDeductionCategories'

export function payrollSocialCode(line: PayrollLine): PayrollSocialDeduction | undefined {
  const code = line.mapping ?? line.concept
  return line.kind === 'deduction' && payrollSocialDeductions.some(item => item.code === code)
    ? code as PayrollSocialDeduction : undefined
}

export function payrollSocialAmounts(lines: PayrollLine[]): Record<PayrollSocialDeduction, string> {
  const amounts = { eps: '', pension: '', solidarity: '', subsistence: '' }
  // The most recently saved entry supplies the editable value for older duplicates.
  for (const line of lines) {
    const code = payrollSocialCode(line)
    if (code) amounts[code] = line.amount
  }
  return amounts
}

export function replacePayrollSocialLine(lines: PayrollLine[], line: PayrollLine): PayrollLine[] {
  const code = payrollSocialCode(line)
  if (!code) return lines
  const first = lines.findIndex(item => payrollSocialCode(item) === code)
  if (first < 0) return [...lines, line]
  return lines.flatMap((item, index) => index === first ? [line] : payrollSocialCode(item) === code ? [] : [item])
}
