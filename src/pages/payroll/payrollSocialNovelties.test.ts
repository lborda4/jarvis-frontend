import { expect, it } from 'vitest'
import type { PayrollLine } from '../../utils/payrollDomain'
import { payrollSocialAmounts, payrollSocialCode, replacePayrollSocialLine } from './payrollSocialNovelties'

const deduction = (concept: string, amount: string, id = concept): PayrollLine => ({ id, concept, kind: 'deduction', quantity: '1', amount })

it('carga el último valor de cada concepto sin sumar los duplicados anteriores', () => {
  expect(payrollSocialAmounts([deduction('eps', '60000', 'old'), deduction('pension', '15000'), deduction('eps', '50000')]))
    .toEqual({ eps: '50000', pension: '15000', solidarity: '', subsistence: '' })
})

it.each(['eps', 'pension', 'solidarity', 'subsistence'])('actualiza %s sin duplicarlo y permite guardar cero', code => {
  const original = [deduction('other_deduction', '123'), deduction(code, '100', 'old'), deduction(code, '200', 'latest')]
  const line = { ...original[2], amount: '50' }
  const updated = replacePayrollSocialLine(original, line)
  expect(updated).toEqual([original[0], line])
  const again = replacePayrollSocialLine(updated, { ...line, amount: '0' })
  expect(again).toHaveLength(2)
  expect(payrollSocialAmounts(again)[code as keyof ReturnType<typeof payrollSocialAmounts>]).toBe('0')
  expect(original).toHaveLength(3)
  expect(original[2].amount).toBe('200')
})

it('reconoce conceptos homologados y conserva otros conceptos que sí permiten varias filas', () => {
  const line = { ...deduction('internal_health', '10'), mapping: 'eps' }
  expect(payrollSocialCode(line)).toBe('eps')
  const others = [deduction('other_deduction', '1', 'one'), deduction('other_deduction', '2', 'two')]
  expect(replacePayrollSocialLine([...others, line], deduction('eps', '20'))).toEqual([...others, deduction('eps', '20')])
})
