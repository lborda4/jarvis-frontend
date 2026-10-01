import { describe, expect, it } from 'vitest'
import { colombiaToday, companyTrackingStatus, trackingCsvCell } from './companyTracking'

describe('seguimiento de empresas', () => {
  it.each([
    [null, 'UNCONFIGURED'], ['2026-09-30', 'OVERDUE'], ['2026-10-01', 'DUE_TODAY'],
    ['2026-10-08', 'DUE_SOON'], ['2026-10-09', 'CURRENT'], ['not-a-date', 'UNCONFIGURED'],
  ])('clasifica vencimiento %s', (subscriptionDueDate, expected) => {
    expect(companyTrackingStatus({ subscriptionDueDate }, '2026-10-01')).toBe(expected)
  })
  it('usa el día de Colombia y no el del equipo del administrador', () => {
    expect(colombiaToday(new Date('2026-10-02T02:00:00Z'))).toBe('2026-10-01')
  })
  it('protege la exportación frente a fórmulas y escapa comillas', () => {
    expect(trackingCsvCell('=HYPERLINK("url")')).toBe('"\'=HYPERLINK(""url"")"')
    expect(trackingCsvCell('Empresa "A"')).toBe('"Empresa ""A"""')
  })
})
