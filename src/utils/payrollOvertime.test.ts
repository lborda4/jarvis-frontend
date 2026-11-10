import { describe, expect, it } from 'vitest'
import { dayOvertimeErrors, dayOvertimeMaster, validPayrollTime } from './payrollOvertime'
const line = { concept: 'overtime_day', startTime: '2026-11-08T17:00:00', endTime: '2026-11-08T19:30:00', quantity: '2.5', amount: '100000.25', overtimeSurchargeId: 19 }
describe('Horas extra diurnas', () => {
  it('acepta todos los datos y conserva el ID del catálogo, sin tratarlo como porcentaje', () => expect(dayOvertimeErrors(line, '2026-11')).toEqual([]))
  it.each([
    { startTime: '' }, { endTime: '' }, { endTime: line.startTime }, { endTime: '2026-11-08T16:00:00' },
    { startTime: '2026-11-31T17:00:00' }, { endTime: '2026-12-01T19:00:00' }, { overtimeSurchargeId: 0 },
    { quantity: '0' }, { amount: '-1' },
  ])('rechaza datos incompletos o inválidos: %j', patch => expect(dayOvertimeErrors({ ...line, ...patch }, '2026-11').length).toBeGreaterThan(0))
  it('valida la fecha, hora y segundos sin convertir de zona horaria', () => {
    expect(validPayrollTime('2028-02-29T05:00:59')).toBe(true)
    for (const value of ['2026-02-29T05:00:00', '2026-11-08T24:00:00', '2026-11-08T05:00:00Z']) expect(validPayrollTime(value)).toBe(false)
  })
  it('resuelve por nombre en el catálogo sin fijar el ID ni confundir nocturnas', () => {
    expect(dayOvertimeMaster([{ id: 1, name: 'Hora Extra Nocturna' }, { id: 19, name: 'Hora Extra Diurna', code: '1' }])?.id).toBe(19)
    expect(dayOvertimeMaster([{ id: 1, name: 'Hora Extra Diurna Dominical y Festivos' }])).toBeUndefined()
  })
})
