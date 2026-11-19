import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import SupportDocumentRoute from './SupportDocumentRoute'

const setup = vi.hoisted(() => ({ isCheckingSetup: false, isSupportDocumentEnabled: true,
  integrationProviders: ['JARVIS'], integrationMode: 'jarvis', setupPath: '/configuracion/integracion-jarvis' }))
vi.mock('../context/IntegrationSetupContext', () => ({ useIntegrationSetup: () => setup }))
vi.mock('../pages/SupportDocumentsImportPage', () => ({ default: () => <p>Página de importación de soportes</p> }))
vi.mock('../pages/SalesInvoicePage', () => ({ default: () => <p>Formulario individual</p> }))
vi.mock('../pages/SalesInvoiceListPage', () => ({ default: () => <p>Listado de soportes</p> }))
vi.mock('../pages/SupportDocumentPage', () => ({ default: () => <p>Documentos recibidos</p> }))
beforeEach(() => Object.assign(setup, { isCheckingSetup: false, isSupportDocumentEnabled: true, integrationProviders: ['JARVIS'], integrationMode: 'jarvis' }))

it('permite abrir la importación con la integración Jarvis configurada', () => {
  expect(renderToStaticMarkup(<MemoryRouter><SupportDocumentRoute view="import" /></MemoryRouter>)).toContain('Página de importación de soportes')
})
it('espera la verificación de configuración antes de mostrar la importación', () => {
  setup.isCheckingSetup = true
  const html = renderToStaticMarkup(<MemoryRouter><SupportDocumentRoute view="import" /></MemoryRouter>)
  expect(html).toContain('Verificando configuración')
  expect(html).not.toContain('Página de importación de soportes')
})
it('conserva el control de acceso del módulo de documentos soporte', () => {
  setup.isSupportDocumentEnabled = false
  expect(renderToStaticMarkup(<MemoryRouter><SupportDocumentRoute view="import" /></MemoryRouter>)).not.toContain('Página de importación de soportes')
})
it('no ofrece el importador Jarvis para una empresa con integración Siigo', () => {
  setup.integrationProviders = ['SIIGO']
  expect(renderToStaticMarkup(<MemoryRouter><SupportDocumentRoute view="import" /></MemoryRouter>)).not.toContain('Página de importación de soportes')
})
