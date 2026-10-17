import { describe, expect, it } from 'vitest'
import type { PayrollDocument } from '../../services/payrollService'
import {
  groupPayrollPeriods,
  liquidationType,
  periodLabel,
} from './payrollPeriods'
const document = (
  overrides: Partial<PayrollDocument> = {},
): PayrollDocument => ({
  id: 'doc-1',
  employeeId: 'employee-1',
  originalId: null,
  state: {
    employeeId: 'employee-1',
    period: '2026-10',
    startDate: '2026-10-01',
    endDate: '2026-10-15',
    issueDate: '2026-10-16',
    workedDays: '15',
    paymentDates: [],
    lines: [],
  },
  employee: {} as PayrollDocument['employee'],
  status: 'DRAFT',
  number: null,
  prefix: null,
  cune: null,
  accrued: '100.10',
  deductions: '20.01',
  net: '80.09',
  updatedAt: '',
  ...overrides,
})
describe('períodos de nómina', () => {
  it('mantiene separadas nóminas con nombre propio aunque tengan las mismas fechas', () => {
    const first = document(),
      second = document({ id: 'doc-2', employeeId: 'employee-2' })
    first.state = {
      ...first.state,
      payrollGroupId: 'group-1',
      payrollName: 'Administración',
      periodicity: 'FIRST_HALF',
    }
    second.state = {
      ...second.state,
      payrollGroupId: 'group-2',
      payrollName: 'Ventas',
      periodicity: 'FIRST_HALF',
    }
    const groups = groupPayrollPeriods([first, second])
    expect(groups).toHaveLength(2)
    expect(groups.map((g) => g.label).sort()).toEqual([
      'Administración',
      'Ventas',
    ])
    expect(
      groups.every((g) => g.employees === 1 && g.type === 'Quincenal 1'),
    ).toBe(true)
  })
  it('separa las dos quincenas y conserva los totales completos del período', () => {
    const first = document(),
      second = document({ id: 'doc-2', employeeId: 'employee-2' }),
      next = document({
        id: 'doc-3',
        state: {
          ...first.state,
          startDate: '2026-10-16',
          endDate: '2026-10-31',
        },
      })
    const groups = groupPayrollPeriods([first, second, next])
    expect(groups).toHaveLength(2)
    expect(groups[0].type).toBe('Quincenal 2')
    expect(groups[1]).toMatchObject({
      type: 'Quincenal 1',
      employees: 2,
      accrued: '200.20',
      deductions: '40.02',
      net: '160.18',
    })
  })
  it('no marca como aceptado un período con documentos pendientes', () => {
    const [period] = groupPayrollPeriods([
      document({ status: 'ACCEPTED' }),
      document({ id: 'doc-2', status: 'DRAFT' }),
    ])
    expect(period.status).toBe('PROCESSING')
    expect(period.statusLabel).toBe('En proceso')
  })
  it('indica rechazos sin ocultar los documentos aceptados del mismo período', () => {
    const [period] = groupPayrollPeriods([
      document({ status: 'ACCEPTED' }),
      document({ id: 'doc-2', status: 'REJECTED' }),
    ])
    expect(period.statusLabel).toBe('Con rechazos')
    expect(period.net).toBe('160.18')
  })
  it('reconoce meses completos incluidos febrero bisiesto y períodos personalizados', () => {
    expect(liquidationType('2024-02-01', '2024-02-29')).toBe('Mensual')
    expect(liquidationType('2026-02-16', '2026-02-28')).toBe('Quincenal 2')
    expect(liquidationType('2026-10-03', '2026-10-20')).toBe('Personalizada')
    expect(periodLabel('2026-10')).toBe('Octubre 2026')
  })
})
