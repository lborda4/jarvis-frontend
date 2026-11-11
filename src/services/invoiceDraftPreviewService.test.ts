import { beforeEach, expect, it, vi } from 'vitest'
import { fetchInvoiceDraftPreview } from './invoiceDraftPreviewService'

const mocks = vi.hoisted(() => ({ draft: vi.fn(), settings: vi.fn(), taxes: vi.fn(), methods: vi.fn(), customer: vi.fn(), get: vi.fn() }))
vi.mock('./invoiceDraftService', () => ({ fetchInvoiceDraft: mocks.draft }))
vi.mock('./jarvisService', () => ({ fetchJarvisCredentialsStatus: mocks.settings, fetchJarvisTaxes: mocks.taxes, fetchJarvisTerceros: mocks.customer }))
vi.mock('./jarvisPaymentMethodService', () => ({ fetchJarvisPaymentMethods: mocks.methods }))
vi.mock('./apiClient', () => ({ apiClient: { get: mocks.get } }))
const company = { id: 'owner', name: 'Empresa', nit: '123-1' }
beforeEach(() => {
  vi.resetAllMocks()
  mocks.draft.mockResolvedValue({ documentKind: 'ELECTRONIC_INVOICE', state: {} })
  mocks.settings.mockResolvedValue({ vat_regime: 'non_vat_responsible' })
  mocks.taxes.mockResolvedValue({ items: [] })
  mocks.methods.mockResolvedValue({ items: [] })
  mocks.get.mockResolvedValue({ data: { logoDataUrl: null } })
})

it('prepara un guardado incompleto con servicios locales sin pedir datos de una factura emitida', async () => {
  const result = await fetchInvoiceDraftPreview('draft', 'ELECTRONIC_INVOICE', company)
  expect(mocks.draft).toHaveBeenCalledExactlyOnceWith('draft')
  expect(result).toMatchObject({ isDraft: true, cufe: '', items: [], issuerTaxProfile: { vatRegime: 'non_vat_responsible' } })
  expect(mocks.get).toHaveBeenCalledExactlyOnceWith('/integrations/JARVIS/logo')
  expect(mocks.customer).not.toHaveBeenCalled()
})

it('rechaza un documento de otro módulo antes de consultar los demás datos', async () => {
  await expect(fetchInvoiceDraftPreview('draft', 'SUPPORT_DOCUMENT', company)).rejects.toThrow('otro tipo de documento')
  expect(mocks.settings).not.toHaveBeenCalled()
  expect(mocks.get).not.toHaveBeenCalled()
})

it('abre el borrador aunque no se pueda cargar el logo y completa el tercero guardado', async () => {
  mocks.draft.mockResolvedValue({ documentKind: 'ELECTRONIC_INVOICE', state: { selectedCustomer: { id: 'customer', name: 'Cliente', document_number: '456' } } })
  mocks.get.mockRejectedValue(new Error('Sin logo'))
  mocks.customer.mockResolvedValue({ items: [{ id: 'customer', email: 'cliente@example.com', address: 'Calle 1' }] })
  const result = await fetchInvoiceDraftPreview('draft', 'ELECTRONIC_INVOICE', company)
  expect(result.buyer).toMatchObject({ name: 'Cliente', documentNumber: '456', address: 'Calle 1', email: 'cliente@example.com' })
  expect(result.logoDataUrl).toBeNull()
})
