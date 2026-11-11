import { describe, expect, it } from 'vitest'
import { colombiaToday, companyTrackingStatus, trackingCsvCell, trackingDocumentBalance, trackingBillingMonths, trackingPeriodLabel, trackingRenewalDueDate } from './companyTracking'
import type { AdminIntegrationItem } from '../types/admin'

describe('seguimiento de empresas', () => {
  it('anticipa la renovación desde el vencimiento vigente o desde hoy si ya venció', () => {
    expect(trackingRenewalDueDate({ subscriptionDueDate: '2026-10-09' }, 1, '2026-11-11')).toBe('2026-12-11')
    expect(trackingRenewalDueDate({ subscriptionDueDate: '2026-12-30' }, 3, '2026-11-11')).toBe('2027-03-30')
    expect(trackingRenewalDueDate({ subscriptionDueDate: '2026-01-31' }, 1, '2026-01-15')).toBe('2026-02-28')
    expect(trackingRenewalDueDate({ subscriptionDueDate: null }, 12, '2026-11-11')).toBe('2027-11-11')
    expect(trackingRenewalDueDate({}, 0, '2026-11-11')).toBeNull()
  })
  it('muestra los meses configurados y conserva los periodos antiguos', () => {
    expect(trackingBillingMonths({ billingCycle: 'MONTHLY' })).toBe(1)
    expect(trackingBillingMonths({ billingCycle: 'ANNUAL' })).toBe(12)
    expect(trackingBillingMonths({})).toBeNull()
    expect(trackingPeriodLabel({ billingMonths: 3, billingCycle: 'ANNUAL' })).toBe('3 meses')
    expect(trackingPeriodLabel({ billingMonths: 1 })).toBe('1 mes')
    expect(trackingPeriodLabel({ billingCycle: 'ANNUAL' })).toBe('12 meses')
    expect(trackingPeriodLabel({})).toBe('Sin definir')
  })
  it('distingue cupos agotados, sin límite y saldos no informados', () => {
    const integration = {} as AdminIntegrationItem
    expect(trackingDocumentBalance(integration)).toBe('—')
    integration.documentQuota = { documentLimit: 50, documentsUsed: 50, remaining: 0 }
    expect(trackingDocumentBalance(integration)).toBe('0')
    integration.documentQuota = { documentLimit: 2000, documentsUsed: 500, remaining: 1500 }
    expect(trackingDocumentBalance(integration)).toBe('1.500')
    integration.documentQuota = { documentLimit: null, documentsUsed: 500, remaining: null }
    expect(trackingDocumentBalance(integration)).toBe('Sin límite')
  })
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
