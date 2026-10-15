import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { IntegrationSetupProvider, useIntegrationSetup } from '../context/IntegrationSetupContext'
import { clearTokens } from '../services/authStorage'
import { readIntegrationSetupSnapshot, saveIntegrationSetupSnapshot } from './integrationSetupSnapshot'

vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { id: 'user-1', company: { id: 'company-1' } } }) }))
const snapshot = {
  integrationMode: 'jarvis', integrationProviders: ['JARVIS'],
  isJarvisCompanyConfigured: true, isSubscriptionActive: true,
  includedDocumentTypes: ['PURCHASE_INVOICE'], isElectronicInvoiceResolutionConfigured: true,
  documentQuotas: {}, documentLimit: null, documentsUsed: 3, documentsRemaining: null,
}
beforeEach(() => {
  function storage() {
    const data = new Map<string, string>()
    return { get length() { return data.size }, key: (index: number) => [...data.keys()][index] ?? null, getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value), removeItem: (key: string) => data.delete(key) }
  }
  vi.stubGlobal('sessionStorage', storage()); vi.stubGlobal('localStorage', storage())
})
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

it('conserva la configuración al reconstruir la aplicación y la separa por usuario y empresa', () => {
  saveIntegrationSetupSnapshot('user-1', 'company-1', snapshot)
  expect(readIntegrationSetupSnapshot('user-1', 'company-1')).toEqual(snapshot)
  expect(readIntegrationSetupSnapshot('other-user', 'company-1')).toBeNull()
  expect(readIntegrationSetupSnapshot('user-1', 'other-company')).toBeNull()
})

it('no restaura copias de más de 24 horas', () => {
  const now = Date.now()
  saveIntegrationSetupSnapshot('user-1', 'company-1', snapshot)
  vi.spyOn(Date, 'now').mockReturnValue(now + 25 * 60 * 60_000)
  expect(readIntegrationSetupSnapshot('user-1', 'company-1')).toBeNull()
})

it('elimina la configuración guardada al cerrar o expirar la sesión', () => {
  saveIntegrationSetupSnapshot('user-1', 'company-1', snapshot)
  sessionStorage.setItem('other-setting', 'keep')
  clearTokens()
  expect(readIntegrationSetupSnapshot('user-1', 'company-1')).toBeNull()
  expect(sessionStorage.getItem('other-setting')).toBe('keep')
})

function Probe() {
  const setup = useIntegrationSetup()
  return <p>{setup.integrationMode}:{setup.isCheckingSetup ? 'loading' : 'ready'}:{setup.isConfigured ? 'configured' : 'unconfigured'}:{setup.isSalesInvoiceEnabled ? 'sales-enabled' : 'sales-disabled'}</p>
}

it('exige resoluciones en Jarvis aunque no haya documentos incluidos seleccionados', () => {
  saveIntegrationSetupSnapshot('user-1', 'company-1', {
    ...snapshot, includedDocumentTypes: [], isElectronicInvoiceResolutionConfigured: false,
  })
  function ResolutionProbe() {
    const setup = useIntegrationSetup()
    return <p>{String(setup.hasSupportDocumentAccess)}:{String(setup.hasPurchaseInvoiceAccess)}:{String(setup.requiresSetup)}</p>
  }
  expect(renderToStaticMarkup(<IntegrationSetupProvider><ResolutionProbe /></IntegrationSetupProvider>)).toContain('true:true:true')
})

it('abre Jarvis configurado en el primer render sin mostrar reconocimiento de integración', () => {
  saveIntegrationSetupSnapshot('user-1', 'company-1', snapshot)
  expect(renderToStaticMarkup(<IntegrationSetupProvider><Probe /></IntegrationSetupProvider>)).toContain('jarvis:ready:configured:sales-enabled')
})

it('mantiene la comprobación inicial cuando la copia corresponde a otra empresa', () => {
  saveIntegrationSetupSnapshot('user-1', 'other-company', snapshot)
  expect(renderToStaticMarkup(<IntegrationSetupProvider><Probe /></IntegrationSetupProvider>)).toContain('unknown:loading:unconfigured:sales-disabled')
})

it.each([[true, false], [false, true], [true, true], [false, false]])(
  'habilita cada documento con su resolución: venta=%s soporte=%s', (sales, support) => {
    saveIntegrationSetupSnapshot('user-1', 'company-1', {
      ...snapshot, includedDocumentTypes: ['PURCHASE_INVOICE', 'SUPPORT_DOCUMENT'],
      isElectronicInvoiceResolutionConfigured: sales, isSupportDocumentResolutionConfigured: support,
    })
    function DocumentAccessProbe() {
      const setup = useIntegrationSetup()
      return <p>{String(setup.isSalesInvoiceEnabled)}:{String(setup.isSupportDocumentEnabled)}:{String(setup.requiresSetup)}</p>
    }
    expect(renderToStaticMarkup(<IntegrationSetupProvider><DocumentAccessProbe /></IntegrationSetupProvider>))
      .toContain(`${sales}:${support}:${!sales && !support}`)
  },
)

it('permite abrir factura de venta con su resolución aunque el plan esté pendiente', () => {
  saveIntegrationSetupSnapshot('user-1', 'company-1', {
    ...snapshot, isSubscriptionActive: false,
    isElectronicInvoiceResolutionConfigured: true, isSupportDocumentResolutionConfigured: false,
  })
  function AccessProbe() {
    const setup = useIntegrationSetup()
    return <p>{String(setup.isSalesInvoiceEnabled)}:{String(setup.isSupportDocumentEnabled)}:{String(setup.isCreditNoteEnabled)}</p>
  }
  expect(renderToStaticMarkup(<IntegrationSetupProvider><AccessProbe /></IntegrationSetupProvider>)).toContain('true:false:true')
})

it('permite abrir soporte con su resolución sin exigir la de ventas ni un plan activo', () => {
  saveIntegrationSetupSnapshot('user-1', 'company-1', {
    ...snapshot, isSubscriptionActive: false,
    isElectronicInvoiceResolutionConfigured: false, isSupportDocumentResolutionConfigured: true,
  })
  function AccessProbe() {
    const setup = useIntegrationSetup()
    return <p>{String(setup.isSalesInvoiceEnabled)}:{String(setup.isSupportDocumentEnabled)}</p>
  }
  expect(renderToStaticMarkup(<IntegrationSetupProvider><AccessProbe /></IntegrationSetupProvider>)).toContain('false:true')
})
