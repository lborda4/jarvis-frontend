import { beforeEach, expect, it, vi } from 'vitest'
import { createAdvisorCompany, fetchCommissionReport, registerAdvisorSalePayment } from './advisorService'
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
