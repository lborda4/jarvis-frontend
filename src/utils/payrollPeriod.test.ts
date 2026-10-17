import { describe, expect, it } from 'vitest'
import { payrollPeriodBounds, validatePayrollPeriod } from './payrollPeriod'
const request = {
  name: 'Administración octubre',
  period: '2026-10',
  periodicity: 'FIRST_HALF' as const,
  employeeIds: ['11111111-1111-4111-8111-111111111111'],
}
describe('crear un período de nómina', () => {
  it('calcula la primera quincena y la segunda hasta el último día real del mes', () => {
    expect(payrollPeriodBounds('2026-10', 'FIRST_HALF')).toEqual({
      startDate: '2026-10-01',
      endDate: '2026-10-15',
    })
    expect(payrollPeriodBounds('2026-02', 'SECOND_HALF')).toEqual({
      startDate: '2026-02-16',
      endDate: '2026-02-28',
    })
    expect(payrollPeriodBounds('2024-02', 'SECOND_HALF').endDate).toBe(
      '2024-02-29',
    )
    expect(payrollPeriodBounds('2026-04', 'MONTHLY')).toEqual({
      startDate: '2026-04-01',
      endDate: '2026-04-30',
    })
  })
  it.each([
    { ...request, name: '   ' },
    { ...request, period: '' },
    { ...request, period: '2026-13' },
    { ...request, periodicity: '' },
    { ...request, employeeIds: [] },
  ])('exige nombre, mes, periodicidad y empleados', (input) =>
    expect(
      validatePayrollPeriod(input as typeof request).length,
    ).toBeGreaterThan(0),
  )
  it('no permite repetir empleados ni registrar identificadores ajenos al formato esperado', () => {
    expect(
      validatePayrollPeriod({
        ...request,
        employeeIds: [...request.employeeIds, ...request.employeeIds],
      }).join(' '),
    ).toContain('No repitas')
    expect(
      validatePayrollPeriod({ ...request, employeeIds: ['invalid'] }).join(' '),
    ).toContain('inválida')
    expect(validatePayrollPeriod(request)).toEqual([])
  })
})
