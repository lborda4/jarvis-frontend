import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import SalesInvoicesImportPage from './SalesInvoicesImportPage'
import SalesInvoicesImportRoute from '../components/SalesInvoicesImportRoute'

const setup = vi.hoisted(() => ({ isCheckingSetup: false, integrationMode: 'jarvis', isJarvisCompany: true, isSalesInvoiceEnabled: true, setupPath: '/configuracion/integracion-jarvis' }))
vi.mock('../context/IntegrationSetupContext', () => ({ useIntegrationSetup: () => setup }))
beforeEach(() => { setup.isCheckingSetup = false; setup.isJarvisCompany = true; setup.isSalesInvoiceEnabled = true })

it('presenta plantilla, carga y revisión de ventas en una pantalla completa con acciones estándar', () => {
  const html = renderToStaticMarkup(<MemoryRouter><SalesInvoicesImportPage /></MemoryRouter>)
  expect(html).toContain('<h1>Importar facturas de venta</h1>')
  expect(html).toContain('Descargar plantilla')
  expect(html).toContain('Subir Excel')
  expect(html).toContain('>Facturas</h2>')
  expect(html).toContain('Volver al listado')
  expect(html).not.toContain('role="dialog"')
  expect(html).not.toContain('Continuar')
  expect(html).not.toContain('debes crear primero')
})

it('requiere configuración de ventas y proveedor Jarvis antes de abrir la importación', () => {
  const render = () => renderToStaticMarkup(<MemoryRouter><SalesInvoicesImportRoute /></MemoryRouter>)
  expect(render()).toContain('<h1>Importar facturas de venta</h1>')
  setup.isSalesInvoiceEnabled = false
  expect(render()).not.toContain('<h1>Importar facturas de venta</h1>')
  setup.isSalesInvoiceEnabled = true
  setup.isJarvisCompany = false
  expect(render()).not.toContain('<h1>Importar facturas de venta</h1>')
  setup.isJarvisCompany = true
  setup.isCheckingSetup = true
  expect(render()).toContain('Verificando configuración')
})
