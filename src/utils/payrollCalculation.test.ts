import { describe, expect, it } from 'vitest'
import { suggestPayrollAmount } from './payrollCalculation'
import {
  blankEmployee,
  blankParameters,
  defaultConcepts,
} from '../pages/payroll/payrollDefaults'
const worker = { ...blankEmployee(), salary: '2000000' }
const parameters = {
  ...blankParameters(),
  monthlyDays: '30',
  monthlyHours: '200',
}
describe('sugerencias de nómina', () => {
  it('paga solamente el adicional cuando el salario ya contiene la hora ordinaria', () =>
    expect(
      suggestPayrollAmount(
        worker,
        parameters,
        {
          ...defaultConcepts[9],
          base: 'hourly',
          factor: '1.35',
          calculationMode: 'additional',
        },
        '2',
        '30',
      )?.amount,
    ).toBe('7000.00'))
  it('prorratea salario por días', () =>
    expect(
      suggestPayrollAmount(worker, parameters, defaultConcepts[0], '15', '15')
        ?.amount,
    ).toBe('1000000.00'))
  it('muestra fórmula de horas configuradas sin usar constantes legales', () => {
    const value = suggestPayrollAmount(
      worker,
      parameters,
      { ...defaultConcepts[7], base: 'hourly', factor: '1.25' },
      '2',
      '30',
    )
    expect(value?.amount).toBe('25000.00')
    expect(value?.formula).toContain('200 horas')
  })
  it('no aplica descuentos ordinarios a aprendices', () =>
    expect(
      suggestPayrollAmount(
        { ...worker, contractType: 'APPRENTICE' },
        parameters,
        { ...defaultConcepts.at(-1)!, base: 'salary', percentage: '4' },
        '1',
        '30',
      ),
    ).toBeNull())
  it('no asume elegibilidad de auxilio de transporte', () =>
    expect(
      suggestPayrollAmount(worker, parameters, defaultConcepts[1], '30', '30'),
    ).toBeNull())
  it('respeta la base y porcentaje configurados', () =>
    expect(
      suggestPayrollAmount(
        worker,
        parameters,
        { ...defaultConcepts.at(-1)!, base: 'salary', percentage: '4' },
        '1',
        '15',
      )?.amount,
    ).toBe('40000.00'))
})
