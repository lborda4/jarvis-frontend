import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import CreateCompanyForm from './CreateCompanyForm'
import AdvisorCommissionPreview from './AdvisorCommissionPreview'
import { CommissionSalesTable } from './CommissionReport'
import { AdvisorClients } from '../pages/AdvisorAccountPage'
import type { AdminPlan } from '../types/admin'
import type { AdvisorSale } from '../types/advisor'

const plan: AdminPlan = { id: 'plan', code: 'plus', name: 'Siigo Plus', provider: 'SIIGO', documentLimit: 100, includedDocumentTypes: ['SUPPORT_DOCUMENT'], commissionClass: 'PLUS', salePriceCop: 100000 }
const rates = { BASIC: 10, PLUS: 15, PRO: 20 }
it('reuses the company fields and shows the product commission without administrative controls for the advisor', () => {
  const form = (advisor: boolean) => renderToStaticMarkup(<CreateCompanyForm advisor={advisor} plans={[plan]} cities={[]} topUpCatalog={[]} createCompany={async () => { throw Error('No network') }} lookupName={async () => ({ name: null })} onCreated={() => {}}
    selectionSummary={plans => <AdvisorCommissionPreview plans={plans} topUps={[]} rates={rates} />} />)
  const html = form(true)
  for (const value of ['NIT', 'Nombre de la empresa', 'Correo de bienvenida', 'Información de contacto', 'SIIGO', 'Jarvis', 'Selecciona una integración']) expect(html).toContain(value)
  expect(html.indexOf('>Integraciones</legend>')).toBeLessThan(html.indexOf('Información de la empresa'))
  expect(html).not.toContain('admin-company-billing-months')
  expect(html).not.toContain('15 %')
  expect(html).not.toContain('admin-responsible-email')
  expect(html).not.toContain('id="admin-company-commercial"'); expect(html).not.toContain('Bold')
  expect(form(false)).toContain('id="admin-company-commercial"'); expect(form(false)).toContain('Bold')
  expect(html).not.toContain('role="dialog"')
})
it('previews commissions for all three classes and does not guess missing catalog information', () => {
  for (const [tier, rate] of Object.entries(rates)) {
    const html = renderToStaticMarkup(<AdvisorCommissionPreview plans={[{ ...plan, commissionClass: tier as NonNullable<AdminPlan['commissionClass']> }]} topUps={[]} rates={rates} />)
    expect(html).toContain(`${rate} %`)
  }
  expect(renderToStaticMarkup(<AdvisorCommissionPreview plans={[{ ...plan, commissionClass: null }]} topUps={[]} rates={rates} />)).toContain('Pendiente de configurar')
})
it('offers payment registration only to administrators and paginates the full result', () => {
  const sale: AdvisorSale = { id: 'sale', advisorId: 'advisor', advisorName: 'Laura', companyId: 'client', companyName: 'Cliente', companyNit: '900', provider: 'JARVIS', kind: 'TOP_UP', productName: '10 documentos', priceCop: 25000, commissionClass: 'BASIC', commissionRate: 10, commissionCop: 2500, createdAt: '2026-11-21T15:00:00Z', paidAt: null }
  const render = (admin: boolean, count: number) => renderToStaticMarkup(<CommissionSalesTable rows={Array.from({ length: count }, (_, i) => ({ ...sale, id: String(i) }))} admin={admin} />)
  expect(render(false, 1)).not.toContain('Registrar pago'); expect(render(false, 1)).toContain('Pendiente')
  expect(render(true, 1)).toContain('Registrar pago'); expect(render(true, 10)).not.toContain('Siguiente'); expect(render(true, 11)).toContain('Siguiente')
  expect(render(false, 0)).not.toContain('Siguiente')
  const renewal = renderToStaticMarkup(<CommissionSalesTable rows={[{ ...sale, kind: 'PLAN', commissionStage: 'RENEWAL', commissionRate: 7.5, paidAt: '2026-11-21T15:00:00Z' }]} />)
  expect(renewal).toContain('Renovación'); expect(renewal).toContain('7,5 %')
})
it('shows the advisor client list with no pagination for one page', () => {
  const html = renderToStaticMarkup(<AdvisorClients clients={[{ id: 'c', name: 'Cliente', nit: '900', createdAt: '2026-11-21T15:00:00Z', plans: [{ name: 'Plus', provider: 'SIIGO' }] }]} />)
  expect(html).toContain('Mis clientes (1)'); expect(html).toContain('SIIGO: Plus'); expect(html).not.toContain('Siguiente')
})
