import { beforeEach, expect, it, vi } from 'vitest'
import { createAdvisorCompany, fetchAdvisorCatalog, fetchAdvisorDashboard, lookupAdvisorCompanyName, fetchCommissionReport, registerAdvisorSalePayment } from './advisorService'
import { apiClient } from './apiClient'
vi.mock('./apiClient', () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }))
beforeEach(() => { vi.clearAllMocks(); vi.mocked(apiClient.get).mockResolvedValue({ data: {} }); vi.mocked(apiClient.post).mockResolvedValue({ data: {} }) })
it('uses the advisor company endpoint and lets the server assign ownership', async () => {
  const input = { name: 'Cliente', nit: '900', personType: 'LEGAL_ENTITY' as const, integrations: ['SIIGO' as const], siigoPlanId: 'plan' }
  await createAdvisorCompany(input)
  expect(apiClient.post).toHaveBeenCalledWith('/advisor/companies', input)
})
it('cannot select another advisor when retrieving an advisor report', async () => {
  await fetchCommissionReport('2026-11', false, { advisorId: 'other', companyId: 'other' })
  expect(apiClient.get).toHaveBeenCalledWith('/advisor/commissions', { params: { month: '2026-11' } })
  await fetchCommissionReport('2026-11', true, { companyId: 'client' })
  expect(apiClient.get).toHaveBeenLastCalledWith('/admin/advisor-sales', { params: { month: '2026-11', companyId: 'client' } })
})
it('registers a catalog sale payment without accepting a client-supplied commission or date', async () => {
  await registerAdvisorSalePayment('sale')
  expect(apiClient.post).toHaveBeenCalledWith('/admin/advisor-sales/sale/payment')
})

it('scopes admin portal requests to the selected advisor without switching authentication', async () => {
  await fetchAdvisorDashboard('advisor-a')
  expect(apiClient.get).toHaveBeenLastCalledWith('/admin/advisors/advisor-a/dashboard')
  await fetchAdvisorDashboard('advisor-b')
  expect(apiClient.get).toHaveBeenLastCalledWith('/admin/advisors/advisor-b/dashboard')
  await fetchAdvisorCatalog('advisor-b')
  expect(apiClient.get).toHaveBeenLastCalledWith('/admin/advisors/portal/catalog')
  await lookupAdvisorCompanyName('900', 'advisor-b')
  expect(apiClient.get).toHaveBeenLastCalledWith('/admin/advisors/portal/lookup-name', { params: { nit: '900' } })
  const input = { name: 'Cliente', nit: '900', personType: 'LEGAL_ENTITY' as const, integrations: ['SIIGO' as const], siigoPlanId: 'plan' }
  await createAdvisorCompany(input, 'advisor-b')
  expect(apiClient.post).toHaveBeenCalledWith('/admin/advisors/advisor-b/companies', input)
  await fetchCommissionReport('2026-11', true, { advisorId: 'advisor-b' })
  expect(apiClient.get).toHaveBeenLastCalledWith('/admin/advisor-sales', { params: { month: '2026-11', advisorId: 'advisor-b' } })
})
