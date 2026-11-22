import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { expect, it } from 'vitest'
import { ClientSummary, PaymentHistory } from './AdminClientDetailPage'
import AdminTracking from '../components/AdminTracking'
import type { AdminCommercialActivity, AdminCompanyListItem } from '../types/admin'

const company = {
  id: 'client-a', name: 'Cliente de prueba', nit: '900123456', createdAt: '2026-01-01T15:00:00Z', billingMonths: 12,
  subscriptionDueDate: '2099-01-01', integrations: [{ id: 'jarvis-a', provider: 'JARVIS', active: true, subscriptionStatus: 'ACTIVE',
    jarvisCertificateTerm: { startsAt: '2098-01-01T15:00:00Z', endsAt: '2099-01-01T15:00:00Z' },
    documentQuota: { documentLimit: 75, documentsUsed: 33, remaining: 42 },
    plan: { id: 'plan-a', name: 'Facturación electrónica', commercialTerms: { priceCop: 139900 } },
  }],
} as AdminCompanyListItem

it('abre la ficha del cliente desde seguimiento y conserva el saldo real', () => {
  const html = renderToStaticMarkup(<MemoryRouter><AdminTracking companies={[company]} loading={false} onUpdated={() => {}} onCreate={() => {}} /></MemoryRouter>)
  expect(html).toContain('href="/admin/clientes/client-a"')
  const summary = renderToStaticMarkup(<ClientSummary company={company} />)
  expect(summary).toContain('Facturación electrónica')
  expect(summary).toContain('>42</strong>')
  expect(summary).toContain('139.900')
  expect(summary).toContain('2099')
})

it('muestra el vencimiento del certificado aunque la periodicidad produzca otra fecha', () => {
  const differentDate = { ...company, subscriptionDueDate: '2097-06-01' }
  const html = renderToStaticMarkup(<MemoryRouter><AdminTracking companies={[differentDate]} loading={false} onUpdated={() => {}} onCreate={() => {}} /></MemoryRouter>)
  expect(html).toContain('2099')
  expect(html).not.toContain('2097')
  const withoutCertificate = { ...differentDate, integrations: company.integrations.map(item => ({ ...item, jarvisCertificateTerm: null })) }
  expect(renderToStaticMarkup(<ClientSummary company={withoutCertificate} />)).toContain('Certificado sin consultar')
})

it('oculta la paginación en pagos vacíos o de una página y la muestra para más registros', () => {
  const rows: AdminCommercialActivity[] = Array.from({ length: 11 }, (_, index) => ({ id: String(index), kind: 'PAYMENT', createdAt: '2026-11-20T15:00:00Z', amountCop: 139900, planName: 'Plan anual' }))
  for (const activity of [[], rows.slice(0, 9), rows.slice(0, 10)]) {
    expect(renderToStaticMarkup(<PaymentHistory activity={activity} />)).not.toContain('Siguiente')
  }
  const html = renderToStaticMarkup(<PaymentHistory activity={rows} />)
  expect(html).toContain('Siguiente')
  expect(html.match(/Pago registrado/g)).toHaveLength(10)
})
