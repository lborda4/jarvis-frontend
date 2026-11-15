import type { PayrollLine } from '../../utils/payrollDomain'

export function payrollNoveltyKey(line: Pick<PayrollLine, 'kind' | 'concept' | 'mapping'>): string {
  const mapped = line.mapping ?? line.concept
  const code = ['eps', 'pension', 'solidarity', 'subsistence'].includes(mapped) ? mapped : line.concept
  return `${line.kind}:${code}`
}

export function replacePayrollNoveltyLine(lines: PayrollLine[], line: PayrollLine): PayrollLine[] {
  const key = payrollNoveltyKey(line)
  const first = lines.findIndex(item => payrollNoveltyKey(item) === key)
  if (first < 0) return [...lines, line]
  return lines.flatMap((item, index) => index === first ? [line] : payrollNoveltyKey(item) === key ? [] : [item])
}
