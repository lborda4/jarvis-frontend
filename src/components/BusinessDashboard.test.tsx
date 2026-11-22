import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { AdminBusinessOverview } from './BusinessDashboard'
import { AdvisorOverview } from '../pages/AdvisorAccountPage'
import type { AdminCompanyListItem } from '../types/admin'
import type { AdvisorDashboard } from '../types/advisor'

afterEach(() => vi.useRealTimers())
it('prioriza vencimientos y enlaza a cada cliente sin mutar ni exponer credenciales', () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-21T15:00:00Z'))
  const company: AdminCompanyListItem = { id: 'client/1', name: 'Cliente Andino', nit: '900', createdAt: '2026-11-20T15:00:00Z', subscriptionDueDate: '2026-11-20', advisorId: null, integrations: [], description: null, personType: null, responsible: null, inviteCode: 'private-invite', nextPymeToken: 'private-token', technicalKey: null, cityCode: null, cityName: null }
  const html = renderToStaticMarkup(<MemoryRouter><AdminBusinessOverview companies={[company]} onClients={() => {}} onCreate={() => {}} onAdvisors={() => {}} onCommissions={() => {}} /></MemoryRouter>)
  expect(html).toContain('/admin/clientes/client%2F1')
  expect(html).toContain('Vencido')
  expect(html).toContain('Sin asesor')
  expect(html).not.toContain('private-token'); expect(html).not.toContain('private-invite')
  expect(company.subscriptionDueDate).toBe('2026-11-20')
})
it('muestra solo ventas pagadas en la comisión del asesor y separa los cobros pendientes', () => {
  const data: AdvisorDashboard = { advisor: { id: 'a', name: 'Laura' }, clients: [], commissions: { month: '2026-11', paid: [], pending: [], totalSalesCop: 100000, totalCommissionCop: 10000, summary: [] } }
  const html = renderToStaticMarkup(<AdvisorOverview data={data} onClients={() => {}} onCreate={() => {}} onCommissions={() => {}} />)
  expect(html).toContain('10.000'); expect(html).toContain('noviembre de 2026')
  expect(html).toContain('No tienes ventas pendientes de pago.')
  expect(html).not.toContain('Registrar pago'); expect(html).not.toContain('/admin')
})
