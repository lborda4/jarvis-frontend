import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from './apiClient'
import { fetchAdminBoldCredentials, saveAdminBoldCredentials, fetchBoldBindedTerminals, saveBoldCashRegister, updateCompanyJarvisModules, createAdminCompany } from './adminService'
import { jarvisPlanAssignment } from '../utils/adminPlan'
import { applyAdminJarvisTopUp, fetchAdminJarvisTopUps, updateIntegrationSubscription } from './adminService'

vi.mock('./apiClient', () => ({ apiClient: { get: vi.fn(), patch: vi.fn(), post: vi.fn() } }))

it('consulta los precios de recargas en el servidor y guarda por separado sus códigos al crear la empresa', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({ data: { items: [{ code: 'documents_100', priceCop: 149000 }] } })
  expect((await fetchAdminJarvisTopUps()).items[0].priceCop).toBe(149000)
  expect(apiClient.get).toHaveBeenCalledWith('/admin/jarvis/top-ups')
  vi.mocked(apiClient.post).mockResolvedValue({ data: { company: { id: 'company' } } })
  const request = { nit: '123', name: 'Empresa', personType: 'LEGAL_ENTITY' as const, integrations: ['JARVIS' as const], jarvisPlanId: 'plan', jarvisTopUpCodes: ['documents_100'] }
  await createAdminCompany(request)
  expect(apiClient.post).toHaveBeenCalledWith('/admin/companies', request)
})

it('edita o quita recargas y plan juntos sin enviar precios desde el navegador', async () => {
  vi.mocked(apiClient.patch).mockResolvedValue({ data: { company: { id: 'company' }, integration: { commercialTopUps: [] } } })
  const request = { planId: 'combo', topUpCodes: ['documents_100','payroll_5'] }
  const response = await updateIntegrationSubscription('company', 'JARVIS', request)
  expect(apiClient.patch).toHaveBeenCalledWith('/admin/companies/company/integrations/JARVIS/subscription', request)
  expect(response.company?.id).toBe('company')
  await updateIntegrationSubscription('company', 'JARVIS', { planId: 'combo', topUpCodes: [] })
  expect(apiClient.patch).toHaveBeenLastCalledWith('/admin/companies/company/integrations/JARVIS/subscription', { planId: 'combo', topUpCodes: [] })
})

it('edita y quita recargas sin enviar un cambio de plan', async () => {
  vi.mocked(apiClient.patch).mockResolvedValue({ data: { company: { id: 'company' }, integration: { commercialTopUps: [] } } })
  await updateIntegrationSubscription('company', 'JARVIS', { topUpCodes: ['documents_100'] })
  expect(apiClient.patch).toHaveBeenLastCalledWith('/admin/companies/company/integrations/JARVIS/subscription', { topUpCodes: ['documents_100'] })
  await updateIntegrationSubscription('company', 'JARVIS', { topUpCodes: [] })
  expect(apiClient.patch).toHaveBeenLastCalledWith('/admin/companies/company/integrations/JARVIS/subscription', { topUpCodes: [] })
})

it('aplica una recarga acumulativa con un identificador estable y sin cambiar el plan ni enviar precios', async () => {
  vi.mocked(apiClient.post).mockResolvedValue({ data: { company: { id: 'company' }, operation: { id: 'purchase-0000000001', status: 'APPLIED' } } })
  const request = { operationId: 'purchase-0000000001', topUpCodes: ['documents_100'] }
  expect((await applyAdminJarvisTopUp('company', request)).operation.status).toBe('APPLIED')
  expect(apiClient.post).toHaveBeenLastCalledWith('/admin/companies/company/jarvis/top-ups', request)
  await applyAdminJarvisTopUp('company', request)
  expect(apiClient.post).toHaveBeenLastCalledWith('/admin/companies/company/jarvis/top-ups', request)
  expect(request).not.toHaveProperty('planId')
  expect(request).not.toHaveProperty('priceCop')
})

it('envía el ID del plan comercial seleccionado al crear la empresa, sin sumar recargas ni enviar un precio del navegador', async () => {
  const plan = { id: 'server-combo', code: 'jarvis_compliance_initial_annual', name: 'Combo cumplimiento inicial', provider: 'JARVIS' as const, documentLimit: 50, includedDocumentTypes: [],
    commercialTerms: { priceCop: 230000, billingMonths: 12, employeeLimit: 2, modules: ['BILLING' as const, 'PAYROLL' as const], includesDigitalCertificate: true, includesRadian: true } }
  vi.mocked(apiClient.post).mockResolvedValue({ data: { company: { id: 'company', integrations: [{ provider: 'JARVIS', plan }] } } })
  const request = { nit: '123', name: 'Empresa', personType: 'LEGAL_ENTITY' as const, integrations: ['JARVIS' as const], ...jarvisPlanAssignment(plan) }
  const result = await createAdminCompany(request)
  expect(apiClient.post).toHaveBeenCalledWith('/admin/companies', expect.objectContaining({ jarvisPlanId: 'server-combo', jarvisModules: ['BILLING', 'PAYROLL'], billingMonths: 12 }))
  expect(request).not.toHaveProperty('priceCop')
  expect(result.company.integrations[0].plan?.commercialTerms?.priceCop).toBe(230000)
})

it('envía los módulos al crear y editar la empresa', async () => {
  vi.mocked(apiClient.post).mockResolvedValue({ data: { company: { id: 'company' } } })
  vi.mocked(apiClient.patch).mockResolvedValue({ data: { company: { id: 'company', jarvisModules: ['PAYROLL'] } } })
  const request = { nit: '123', name: 'Empresa', personType: 'LEGAL_ENTITY' as const, integrations: ['JARVIS' as const], jarvisModules: ['PAYROLL' as const] }
  await createAdminCompany(request)
  expect(apiClient.post).toHaveBeenCalledWith('/admin/companies', request)
  expect((await updateCompanyJarvisModules('company', ['PAYROLL'])).company.jarvisModules).toEqual(['PAYROLL'])
  expect(apiClient.patch).toHaveBeenCalledWith('/admin/companies/company/jarvis-modules', { jarvisModules: ['PAYROLL'] })
})

describe('credenciales Bold por empresa', () => {
  beforeEach(() => vi.resetAllMocks())
  it('consulta el estado de las llaves de la empresa seleccionada', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { identityKey: 'identity', hasSecretKey: true } })
    expect(await fetchAdminBoldCredentials('company-1')).toEqual({ identityKey: 'identity', hasSecretKey: true })
    expect(apiClient.get).toHaveBeenCalledWith('/admin/companies/company-1/bold/credentials')
  })
  it('envía las dos llaves a la integración de la empresa seleccionada', async () => {
    vi.mocked(apiClient.patch).mockResolvedValue({ data: { identityKey: 'identity', hasSecretKey: true } })
    await saveAdminBoldCredentials('company-2', { identityKey: 'identity', secretKey: 'new-secret' })
    expect(apiClient.patch).toHaveBeenCalledWith('/admin/companies/company-2/bold/credentials', { identityKey: 'identity', secretKey: 'new-secret' })
  })
  it('permite conservar la llave secreta sin devolverla ni reenviarla', async () => {
    vi.mocked(apiClient.patch).mockResolvedValue({ data: { identityKey: 'updated', hasSecretKey: true } })
    await saveAdminBoldCredentials('company-1', { identityKey: 'updated' })
    expect(apiClient.patch).toHaveBeenCalledWith('/admin/companies/company-1/bold/credentials', { identityKey: 'updated' })
  })
})

describe('cajas y datáfonos Bold', () => {
  beforeEach(() => vi.resetAllMocks())
  it('consulta por empresa sin enviar llaves desde el navegador', async () => {
    const response = { payload: { available_terminals: [] }, errors: [] }
    vi.mocked(apiClient.get).mockResolvedValue({ data: response })
    expect(await fetchBoldBindedTerminals('company-1')).toEqual(response)
    expect(apiClient.get).toHaveBeenCalledWith('/bold/payments/binded-terminals', { params: { companyId: 'company-1' }, boldAdministration: true })
  })
  it('guarda el serial seleccionado junto con la caja y empresa', async () => {
    const request = { companyId: 'company-1', cashRegisterName: 'Principal', boldTerminalId: 'serial-123' }
    vi.mocked(apiClient.post).mockResolvedValue({ data: { item: { id: 'mapping-1', ...request } } })
    await saveBoldCashRegister(request)
    expect(apiClient.post).toHaveBeenCalledWith('/bold/cash-registers', request, { boldAdministration: true })
  })
})
