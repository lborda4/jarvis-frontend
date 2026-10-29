import { beforeEach, expect, it, vi } from 'vitest'
import { apiClient } from './apiClient'
import { payrollService, peekPayrollPaymentMethods } from './payrollService'
import { invalidateQueryCache, setActiveCompanyId } from './queryCache'

vi.mock('./apiClient', () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }))
beforeEach(() => { vi.resetAllMocks(); invalidateQueryCache(); setActiveCompanyId('company-a') })

it('consulta exclusivamente el catálogo de pagos de nómina', async () => {
  const data = { items: [{ id: 'cash', name: 'Efectivo', nextpymeMethodId: 10 }], total: 1 }
  vi.mocked(apiClient.get).mockResolvedValue({ data })
  expect(await payrollService.paymentMethods()).toEqual(data)
  expect(apiClient.get).toHaveBeenCalledWith('/integrations/jarvis/payroll/payment-methods')
  expect(apiClient.get).toHaveBeenCalledTimes(1)
})

it('crea una opción de nómina con su nombre y medio de pago sin escribir en facturas', async () => {
  const paymentMethod = { id: 'bank', name: 'Banco de nómina', nextpymeMethodId: 42 }
  vi.mocked(apiClient.post).mockResolvedValue({ data: { paymentMethod } })
  expect(await payrollService.createPaymentMethod({ name: 'Banco de nómina', base: 'transfer' })).toEqual(paymentMethod)
  expect(apiClient.post).toHaveBeenCalledWith('/integrations/jarvis/payroll/payment-methods', { name: 'Banco de nómina', base: 'transfer' })
  expect(apiClient.post).toHaveBeenCalledTimes(1)
})

it('reutiliza en empleados las opciones cargadas y creadas desde configuración', async () => {
  const cash = { id: 'cash', name: 'Efectivo', nextpymeMethodId: 10 }
  const custom = { id: 'bank', name: 'Banco de nómina', nextpymeMethodId: 42 }
  vi.mocked(apiClient.get).mockResolvedValue({ data: { items: [cash], total: 1 } })
  vi.mocked(apiClient.post).mockResolvedValue({ data: { paymentMethod: custom } })
  await payrollService.paymentMethods()
  await payrollService.createPaymentMethod({ name: custom.name, base: 'transfer' })
  expect(await payrollService.paymentMethods()).toEqual({ items: [cash, custom], total: 2 })
  expect(apiClient.get).toHaveBeenCalledTimes(1)
})

it('no comparte las formas de pago entre empresas y permite forzar una nueva consulta', async () => {
  vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { items: [{ id: 'a' }], total: 1 } })
  await payrollService.paymentMethods()
  setActiveCompanyId('company-b')
  vi.mocked(apiClient.get).mockResolvedValue({ data: { items: [], total: 0 } })
  expect(await payrollService.paymentMethods()).toEqual({ items: [], total: 0 })
  await payrollService.paymentMethods({ force: true })
  expect(apiClient.get).toHaveBeenCalledTimes(3)
})

it('conserva las opciones ya guardadas si falla una actualización del catálogo', async () => {
  const data = { items: [{ id: 'bank', name: 'Banco de nómina', nextpymeMethodId: 42 }], total: 1 }
  vi.mocked(apiClient.get).mockResolvedValueOnce({ data })
  await payrollService.paymentMethods()
  vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('Sin conexión'))
  await expect(payrollService.paymentMethods({ force: true })).rejects.toThrow('Sin conexión')
  expect(peekPayrollPaymentMethods()).toEqual(data)
})
