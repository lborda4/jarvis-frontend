import { cents, type PayrollLine } from './payrollDomain'

export const payrollFixedLawDeductionId = (code: string) => code === 'eps' ? 4 : code === 'pension' ? 6 : ['solidarity', 'subsistence'].includes(code) ? 9 : undefined

export function payrollRequiredDeductionErrors(state: {
  lines: PayrollLine[]; epsTypeLawDeductionsId?: number; pensionTypeLawDeductionsId?: number;
}) {
  return (['eps', 'pension'] as const).flatMap(code => {
    const label = code === 'eps' ? 'EPS' : 'pensión'
    const lines = state.lines.filter(line => line.kind === 'deduction' && (line.mapping ?? line.concept) === code)
    if (!lines.length) return [`Completa el valor de ${label} en las novedades.`]
    const errors: string[] = []
    for (const line of lines) {
      try { cents(line.amount) } catch { errors.push(`Ingresa el valor de ${label}; puede ser cero si corresponde.`) }
    }
    return [...new Set(errors)]
  })
}
