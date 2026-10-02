import { expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { FormEvent } from 'react'
import { useSiigoIntegrationSettings } from './useSiigoIntegrationSettings'

const mocks = vi.hoisted(() => ({ save: vi.fn(), refresh: vi.fn(), mark: vi.fn() }))
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { company: { id: 'company' } }, isLoading: false }) }))
vi.mock('../context/SiigoCatalogContext', () => ({ useSiigoCatalog: () => ({ refreshCatalogs: vi.fn(), isLoadingCatalogs: false }) }))
vi.mock('../context/IntegrationSetupContext', () => ({ useIntegrationSetup: () => ({
  markConfigured: mocks.mark, refreshSetupStatus: mocks.refresh, isCheckingSetup: false,
  isSiigoConfigured: false, isSiigoCompany: true, hasSiigoAccounts: false,
  hasSiigoDocumentTypesConfigured: false, hasSupportDocumentAccess: true,
  hasPurchaseInvoiceAccess: false, includedDocumentTypes: ['SUPPORT_DOCUMENT'],
}) }))
vi.mock('../services/siigoService', () => ({
  saveSiigoCredentials: mocks.save, fetchSiigoCredentialsStatus: vi.fn(), fetchSiigoDocumentTypes: vi.fn(),
  startSiigoPurchaseHistorySync: vi.fn(), importSiigoAccountsExcel: vi.fn(), saveSiigoDocumentTypes: vi.fn(),
}))

it('termina el guardado confirmado aunque la actualización de estado siga pendiente', async () => {
  mocks.save.mockResolvedValue({ username: 'test', partner_id: 'test' })
  mocks.refresh.mockReturnValue(new Promise(() => {}))
  let settings!: ReturnType<typeof useSiigoIntegrationSettings>
  function Probe() { settings = useSiigoIntegrationSettings(); return null }
  renderToStaticMarkup(<Probe />)
  await settings.handleSaveCredentials({ preventDefault: vi.fn() } as unknown as FormEvent<HTMLFormElement>)
  expect(mocks.save).toHaveBeenCalledTimes(1)
  expect(mocks.mark).toHaveBeenCalledTimes(1)
  expect(mocks.refresh).toHaveBeenCalledWith({ background: true })
})
