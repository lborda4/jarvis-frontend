import { expect, it, vi } from 'vitest'
import { apiClient } from './apiClient'
import { configureAdminPayrollNumbering, fetchAdminPayrollNumbering } from './adminService'

vi.mock('./apiClient', () => ({ apiClient: { get: vi.fn(), put: vi.fn() } }))
it('consulta y configura solo la empresa seleccionada sin enviar tokens desde el navegador', async () => {
  const result = { complete: true, ranges: [{ prefix: 'NI', nextConsecutive: 15 }, { prefix: 'NA', nextConsecutive: 3 }] }
  vi.mocked(apiClient.get).mockResolvedValue({ data: result })
  vi.mocked(apiClient.put).mockResolvedValue({ data: result })
  expect(await fetchAdminPayrollNumbering('company')).toEqual(result)
  expect(await configureAdminPayrollNumbering('company')).toEqual(result)
  expect(apiClient.get).toHaveBeenCalledWith('/admin/companies/company/jarvis/payroll-numbering')
  expect(apiClient.put).toHaveBeenCalledWith('/admin/companies/company/jarvis/payroll-numbering', {})
})
