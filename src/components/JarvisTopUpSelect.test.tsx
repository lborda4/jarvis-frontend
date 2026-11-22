import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import JarvisTopUpSelect from './JarvisTopUpSelect'
import JarvisCommercialSummary from './JarvisCommercialSummary'
import CompanyJarvisCommercialEditor from './CompanyJarvisCommercialEditor'
import { portfolioPlans } from '../testFixtures/adminPortfolio'
import { topUpCatalog } from '../testFixtures/adminTopUps'
import { commercialSelectionTotal, compatibleTopUpCodes } from '../utils/adminPlan'
import type { AdminCompanyListItem, AdminIntegrationItem } from '../types/admin'

it('permite seleccionar recargas de documentos y empleados con sus precios y sin recarga', () => {
  const html = renderToStaticMarkup(<JarvisTopUpSelect idPrefix="create" plan={portfolioPlans[3]} catalog={topUpCatalog} value={['documents_100','payroll_5']} onChange={() => {}} />)
  expect(html).toContain('Recarga de documentos')
  expect(html).toContain('Recarga de nómina')
  expect(html).toContain('type="checkbox"')
  expect(html).toContain('checked="" value="documents_100"')
  expect(html).toContain('checked="" value="payroll_5"')
  expect(html).toContain('$149.000 COP')
  expect(html).toContain('$88.000 COP')
})

it('solo ofrece las recargas que corresponden al plan y no las ofrece para ilimitados', () => {
  const render = (index: number) => renderToStaticMarkup(<JarvisTopUpSelect idPrefix="test" plan={portfolioPlans[index]} catalog={topUpCatalog} value={[]} onChange={() => {}} />)
  expect(render(0)).toContain('Recarga de documentos')
  expect(render(0)).not.toContain('Recarga de nómina')
  expect(render(2)).toContain('Recarga de nómina')
  expect(render(2)).not.toContain('Recarga de documentos')
  expect(render(4)).toBe('')
  expect(compatibleTopUpCodes(portfolioPlans[2], ['documents_100','payroll_5'], topUpCatalog)).toEqual(['payroll_5'])
  expect(compatibleTopUpCodes(portfolioPlans[4], ['documents_100','payroll_5'], topUpCatalog)).toEqual([])
})

it('permite combinar 100 y 50 documentos y diferencia las recargas del cupo base', () => {
  const catalog = [...topUpCatalog, { code: 'documents_50', name: 'Recarga 50 documentos', kind: 'DOCUMENTS' as const, units: 50, priceCop: 80000 }]
  const codes = ['documents_100', 'documents_50']
  const items = catalog.filter(item => codes.includes(item.code))
  const selector = renderToStaticMarkup(<JarvisTopUpSelect idPrefix="multiple" plan={portfolioPlans[0]} catalog={catalog} value={codes} onChange={() => {}} />)
  expect(selector.match(/checked=""/g)).toHaveLength(2)
  const summary = renderToStaticMarkup(<JarvisCommercialSummary plan={portfolioPlans[0]} topUps={items} showDocumentCapacity />)
  expect(summary).toContain('Documentos de recargas: 150')
  expect(summary).toContain('Cupo total: 200 documentos')
})

it('muestra plan anual, recargas de pago único y un total sin mezclar sus periodicidades', () => {
  const selected = topUpCatalog.filter(item => ['documents_100','payroll_5'].includes(item.code))
  expect(commercialSelectionTotal(portfolioPlans[3], selected)).toBe(467000)
  const html = renderToStaticMarkup(<JarvisCommercialSummary plan={portfolioPlans[3]} topUps={selected} />)
  expect(html).toContain('Plan: $230.000 COP / año')
  expect(html.match(/pago único/g)).toHaveLength(2)
  expect(html).toContain('Total: $467.000 COP')
  expect(commercialSelectionTotal(portfolioPlans[3], [])).toBe(230000)
})

it('ofrece recargar sin editar el plan y muestra el saldo y el historial confirmado', () => {
  const integration: AdminIntegrationItem = { id: 'integration', provider: 'JARVIS', active: true, subscriptionStatus: 'ACTIVE', subscriptionStartedAt: null, includedDocumentTypes: [], plan: portfolioPlans[3], documentQuota: { documentLimit: 150, documentsUsed: 42, remaining: 108 }, topUpOperations: [{ id: 'purchase', periodStart: '2026-01-01', createdAt: '2026-06-01T12:00:00Z', status: 'APPLIED', topUps: [topUpCatalog[1]] }] }
  const company = { id: 'company', name: 'Empresa', integrations: [integration] } as AdminCompanyListItem
  const html = renderToStaticMarkup(<CompanyJarvisCommercialEditor company={company} integration={integration} plans={portfolioPlans} catalog={topUpCatalog} onSaved={() => {}} />)
  expect(html).toContain('>Editar plan</button>')
  expect(html).toContain('>Recargar</button>')
  expect(html).toContain('Combo cumplimiento inicial')
  expect(html).toContain('Recarga 100 documentos')
  expect(html).toContain('$149.000 COP')
  expect(html).toContain('Documentos disponibles: 108')
  expect(html).toContain('Historial de recargas (1)')
  expect(html).toContain('Aplicada')
  expect(html).not.toContain('role="dialog"')
})

it('muestra la vigencia guardada del certificado Jarvis sin usar la fecha general de la empresa', () => {
  const integration: AdminIntegrationItem = { id: 'integration', provider: 'JARVIS', active: true, subscriptionStatus: 'ACTIVE', subscriptionStartedAt: '2026-12-07T03:00:00Z', includedDocumentTypes: [], plan: portfolioPlans[0],
    jarvisCertificateTerm: { startsAt: '2026-12-07T03:00:00Z', endsAt: '2027-12-07T03:00:00Z', checkedAt: '2026-12-07T10:00:00Z' } }
  const company = { id: 'company', name: 'Empresa', subscriptionDueDate: '2030-01-01', integrations: [integration] } as AdminCompanyListItem
  const html = renderToStaticMarkup(<CompanyJarvisCommercialEditor company={company} integration={integration} plans={portfolioPlans} catalog={topUpCatalog} onSaved={() => {}} />)
  expect(html).toContain('Inicio: 06/12/2026')
  expect(html).toContain('Vence: 06/12/2027')
  expect(html).not.toContain('2030-01-01')
})
