import { describe, expect, it } from 'vitest'
import type { AdvisorSale } from '../types/advisor'
import { commercialSalesCsv, filterCommercialSales } from './commercialDashboard'

const sale: AdvisorSale = { id: 's', advisorId: 'a', advisorName: 'Laura', companyId: 'c', companyName: 'Compañía Andina', companyNit: '900123', provider: 'JARVIS', kind: 'PLAN', productName: 'Facturación básica', priceCop: 139900, commissionClass: 'BASIC', commissionRate: 10, commissionCop: 13990, createdAt: '2026-11-01T01:00:00Z', paidAt: null }
describe('reportes comerciales', () => {
  it('combina búsqueda sin tildes, integración y tipo de producto', () => {
    const rows = [sale, { ...sale, id: 'r', provider: 'SIIGO', kind: 'TOP_UP' as const, productName: 'Recarga Plus' }]
    expect(filterCommercialSales(rows, 'compania', 'JARVIS', 'PLAN').map(item => item.id)).toEqual(['s'])
    expect(filterCommercialSales(rows, '900123', 'SIIGO', 'TOP_UP').map(item => item.id)).toEqual(['r'])
    expect(filterCommercialSales(rows, '  LAURA  ', '', 'TOP_UP')).toHaveLength(1)
    expect(filterCommercialSales(rows, 'facturacion', 'SIIGO')).toHaveLength(0)
    expect(filterCommercialSales([], '')).toEqual([])
  })
  it('exporta valores y pagos sin confundir pendientes con comisiones causadas y protege fórmulas', () => {
    const csv = commercialSalesCsv([sale, { ...sale, id: 'r', companyName: '=HYPERLINK("test")', commissionStage: 'RENEWAL', commissionRate: 7.5, paidAt: '2026-11-21T15:00:00Z' }])
    expect(csv).toContain('"Pendiente"')
    expect(csv).toContain('"Pagado"')
    expect(csv).toContain('"Renovación"')
    expect(csv).toContain('"7.5"')
    expect(csv).toContain('"\'=HYPERLINK(""test"")"')
    expect(csv).toContain('31/10/2026')
    expect(csv).toContain('21/11/2026')
    expect(commercialSalesCsv([]).split('\r\n')).toHaveLength(1)
  })
})
