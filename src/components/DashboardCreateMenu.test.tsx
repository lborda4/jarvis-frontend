import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import DashboardCreateMenu from './DashboardCreateMenu'

const mocks = vi.hoisted(() => ({ modules: ['BILLING', 'PAYROLL'] as string[], setup: {} as Record<string, unknown> }))
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { company: { jarvisModules: mocks.modules } } }) }))
vi.mock('../context/IntegrationSetupContext', () => ({ useIntegrationSetup: () => mocks.setup }))
beforeEach(() => {
  mocks.modules = ['BILLING', 'PAYROLL']
  mocks.setup = { isCheckingSetup: false, integrationMode: 'jarvis', isJarvisCompany: true, isConfigured: true,
    isJarvisCompanyConfigured: true, isSalesInvoiceEnabled: true, isCreditNoteEnabled: true, isSupportDocumentEnabled: true }
})
describe.each(['inline', 'floating'] as const)('menú de creación %s', variant => {
  const render = () => renderToStaticMarkup(<MemoryRouter><DashboardCreateMenu variant={variant} /></MemoryRouter>)

  it('ofrece los formularios habilitados y abre los catálogos en creación', () => {
    const html = render()
    for (const path of ['/factura-venta/nueva', '/nota-credito/nueva', '/nota-debito/nueva', '/documento-soporte/nuevo', '/nota-ajuste/nueva', '/nomina/nueva', '/eventos-radian', '/terceros?create=1', '/productos/listar?create=1', '/impuestos-retenciones?create=1', '/formas-de-pago?create=1']) expect(html).toContain(`href="${path}"`)
  })

  it('oculta facturas y sus notas si solo está habilitado documento soporte', () => {
    mocks.setup.isSalesInvoiceEnabled = false
    mocks.setup.isCreditNoteEnabled = false
    const html = render()
    expect(html).toContain('/documento-soporte/nuevo')
    expect(html).toContain('/nota-ajuste/nueva')
    expect(html).not.toContain('/factura-venta/nueva')
    expect(html).not.toContain('/nota-credito/nueva')
    expect(html).not.toContain('/nota-debito/nueva')
  })

  it('respeta los módulos de empresa aunque existan indicadores de facturación activos', () => {
    mocks.modules = ['PAYROLL']
    const html = render()
    expect(html).toContain('/nomina/nueva')
    expect(html).not.toContain('/factura-venta/nueva')
    expect(html).not.toContain('/eventos-radian')
    expect(html).not.toContain('Catálogos')
    mocks.modules = ['BILLING']
    expect(render()).not.toContain('/nomina/nueva')
  })

  it('oculta catálogos y RADIAN cuando falta configurar la empresa', () => {
    mocks.setup.isConfigured = false
    mocks.setup.isJarvisCompanyConfigured = false
    const html = render()
    expect(html).not.toContain('Catálogos')
    expect(html).not.toContain('/eventos-radian')
  })

  it('no ofrece enlaces mientras se comprueban las habilitaciones ni sin opciones', () => {
    mocks.setup.isCheckingSetup = true
    expect(render()).not.toContain('href=')
    expect(render()).toContain('disabled')
    mocks.setup.isCheckingSetup = false
    mocks.modules = []
    expect(render()).not.toContain('href=')
    expect(render()).not.toContain('<details')
  })
})
