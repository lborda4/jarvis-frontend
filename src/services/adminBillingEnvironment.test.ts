import { expect, it, vi } from 'vitest'
import { apiClient } from './apiClient'
import { configureAdminBillingEnvironment, fetchAdminBillingEnvironment } from './adminService'

vi.mock('./apiClient', () => ({ apiClient: { get: vi.fn(), put: vi.fn() } }))
it('consulta y cambia el ambiente por la ruta admin de la empresa activa', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({ data: { environment: 1 } })
  vi.mocked(apiClient.put).mockResolvedValue({ data: { environment: 2 } })
  expect(await fetchAdminBillingEnvironment('company')).toEqual({ environment: 1 })
  expect(await configureAdminBillingEnvironment('company', 2)).toEqual({ environment: 2 })
  expect(apiClient.get).toHaveBeenCalledWith('/admin/companies/company/jarvis/billing-environment')
  expect(apiClient.put).toHaveBeenCalledWith('/admin/companies/company/jarvis/billing-environment', { environment: 2 })
})
